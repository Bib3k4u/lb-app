package com.limitbeyond.insights.internal;

import com.limitbeyond.insights.web.InsightsDtos;
import java.sql.Timestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL read side for dashboards. RLS remains active because these queries run
 * on the same transaction connection as the authenticated request. */
@Repository
class InsightsRepository {
    private static final String LOCATION_FILTER = "(CAST(:locationId AS uuid) IS NULL OR %s = :locationId)";

    private final NamedParameterJdbcTemplate jdbc;

    InsightsRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    long countMembers(UUID gymId, UUID locationId) {
        return scalar("SELECT count(*) FROM member_records mr WHERE (CAST(:gymId AS uuid) IS NULL OR mr.gym_id = :gymId) AND "
                + filter("mr.primary_location_id"), params(gymId, locationId));
    }

    long countActiveMembers(UUID gymId, UUID locationId) {
        return scalar("SELECT count(*) FROM member_records mr JOIN users u ON u.id = mr.user_id "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR mr.gym_id = :gymId) AND u.state = 'ACTIVE' AND " + filter("mr.primary_location_id"),
                params(gymId, locationId));
    }

    long countInactiveMembers(UUID gymId, UUID locationId) {
        return scalar("SELECT count(*) FROM member_records mr JOIN users u ON u.id = mr.user_id "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR mr.gym_id = :gymId) AND u.state <> 'ACTIVE' AND " + filter("mr.primary_location_id"),
                params(gymId, locationId));
    }

    long countExpiringMemberships(UUID gymId, UUID locationId, LocalDate today, LocalDate soon) {
        return scalar("SELECT count(*) FROM memberships m JOIN member_records mr ON mr.id = m.member_record_id "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR mr.gym_id = :gymId) AND m.state = 'ACTIVE' AND m.expires_on BETWEEN :today AND :soon AND "
                + filter("mr.primary_location_id"), params(gymId, locationId, today, soon));
    }

    long countTrainers(UUID gymId, UUID locationId) {
        return scalar("SELECT count(DISTINCT rg.user_id) FROM role_grants rg "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR rg.gym_id = :gymId) AND rg.role = 'TRAINER' AND rg.revoked_at IS NULL AND "
                + "(rg.is_gym_wide OR EXISTS (SELECT 1 FROM role_grant_locations rgl WHERE rgl.role_grant_id = rg.id "
                + "AND " + filter("rgl.location_id") + "))", params(gymId, locationId));
    }

    long countCheckIns(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        return scalar("SELECT count(*) FROM check_ins c WHERE (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt "
                + "AND c.occurred_at < :toAt AND " + filter("c.location_id"), params(gymId, locationId, from, to));
    }

    long countUniqueMembersCheckedIn(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        return scalar("SELECT count(DISTINCT c.user_id) FROM check_ins c JOIN member_records mr ON mr.user_id = c.user_id "
                + "AND mr.gym_id = c.gym_id WHERE (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt "
                + "AND c.occurred_at < :toAt AND " + filter("c.location_id"), params(gymId, locationId, from, to));
    }

    long countCompletedWorkouts(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        return scalar("SELECT count(*) FROM workout_logs w WHERE (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' "
                + "AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND " + filter("w.location_id"),
                params(gymId, locationId, from, to));
    }

    List<InsightsDtos.DailyActivity> dailyActivity(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        String sql = "SELECT d.day::date, COALESCE(ci.member_check_ins, 0), COALESCE(ci.trainer_check_ins, 0), "
                + "COALESCE(ci.total_check_ins, 0), COALESCE(ci.unique_members, 0), COALESCE(w.completed_workouts, 0) "
                + "FROM generate_series(CAST(:fromDate AS date), CAST(:toDate AS date) - 1, interval '1 day') AS d(day) "
                + "LEFT JOIN (SELECT date_trunc('day', c.occurred_at AT TIME ZONE 'Asia/Kolkata')::date AS activity_day, "
                + "count(*) total_check_ins, count(*) FILTER (WHERE mr.id IS NOT NULL) member_check_ins, "
                + "count(*) FILTER (WHERE mr.id IS NULL) trainer_check_ins, count(DISTINCT mr.user_id) unique_members "
                + "FROM check_ins c LEFT JOIN member_records mr ON mr.user_id = c.user_id AND mr.gym_id = c.gym_id "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt AND c.occurred_at < :toAt AND " + filter("c.location_id")
                + " GROUP BY 1) ci ON ci.activity_day = d.day::date "
                + "LEFT JOIN (SELECT date_trunc('day', w.performed_at AT TIME ZONE 'Asia/Kolkata')::date AS activity_day, count(*) completed_workouts "
                + "FROM workout_logs w WHERE (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' AND w.performed_at >= :fromAt "
                + "AND w.performed_at < :toAt AND " + filter("w.location_id") + " GROUP BY 1) w ON w.activity_day = d.day::date ORDER BY d.day";
        ZoneId businessZone = ZoneId.of("Asia/Kolkata");
        return jdbc.query(sql, params(gymId, locationId, from, to)
                .addValue("fromDate", from.toInstant().atZone(businessZone).toLocalDate())
                .addValue("toDate", to.toInstant().atZone(businessZone).toLocalDate()),
                (rs, n) -> new InsightsDtos.DailyActivity(rs.getObject(1, LocalDate.class), rs.getLong(2),
                        rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getLong(6)));
    }

    List<InsightsDtos.RecentCheckIn> recentCheckIns(UUID gymId, UUID locationId, Timestamp from, Timestamp to, int limit) {
        String sql = "SELECT c.id, c.user_id, concat_ws(' ', u.first_name, u.last_name), "
                + "CASE WHEN mr.id IS NOT NULL THEN 'MEMBER' ELSE 'STAFF' END, c.location_id, l.name, c.occurred_at, "
                + "c.method, c.purpose, c.distance_m, c.is_flagged FROM check_ins c JOIN users u ON u.id = c.user_id "
                + "JOIN locations l ON l.id = c.location_id LEFT JOIN member_records mr ON mr.user_id = c.user_id AND mr.gym_id = c.gym_id "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt AND c.occurred_at < :toAt AND " + filter("c.location_id")
                + " ORDER BY c.occurred_at DESC LIMIT :limit";
        return jdbc.query(sql, params(gymId, locationId, from, to).addValue("limit", limit), (rs, n) ->
                new InsightsDtos.RecentCheckIn(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getString(4), rs.getObject(5, UUID.class), rs.getString(6), rs.getTimestamp(7).toInstant(),
                        rs.getString(8), rs.getString(9), (Double) rs.getObject(10), rs.getBoolean(11)));
    }

    List<InsightsDtos.TrainerActivity> trainers(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        String sql = "SELECT u.id, concat_ws(' ', u.first_name, u.last_name), u.state, "
                + "(SELECT count(*) FROM trainer_assignments ta WHERE ta.trainer_user_id = u.id AND (CAST(:gymId AS uuid) IS NULL OR ta.gym_id = :gymId) "
                + "AND ta.ended_at IS NULL AND " + filter("ta.location_id") + "), "
                + "(SELECT count(*) FROM check_ins c WHERE c.user_id = u.id AND (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt "
                + "AND c.occurred_at < :toAt AND " + filter("c.location_id") + "), "
                + "(SELECT count(*) FROM workout_logs w WHERE w.trainer_user_id = u.id AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' "
                + "AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND " + filter("w.location_id") + "), "
                + "(SELECT max(c.occurred_at) FROM check_ins c WHERE c.user_id = u.id AND (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND " + filter("c.location_id") + ") "
                + "FROM users u JOIN role_grants rg ON rg.user_id = u.id WHERE (CAST(:gymId AS uuid) IS NULL OR rg.gym_id = :gymId) AND rg.role = 'TRAINER' "
                + "AND rg.revoked_at IS NULL AND (rg.is_gym_wide OR EXISTS (SELECT 1 FROM role_grant_locations rgl WHERE rgl.role_grant_id = rg.id "
                + "AND " + filter("rgl.location_id") + ")) GROUP BY u.id, u.first_name, u.last_name, u.state ORDER BY 6 DESC, 2";
        return jdbc.query(sql, params(gymId, locationId, from, to), (rs, n) -> new InsightsDtos.TrainerActivity(
                rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getLong(5), rs.getLong(6),
                rs.getTimestamp(7) == null ? null : rs.getTimestamp(7).toInstant()));
    }

    List<InsightsDtos.TrainerDailyActivity> trainerDailyActivity(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        String sql = "WITH trainers AS (SELECT DISTINCT u.id, concat_ws(' ', u.first_name, u.last_name) name "
                + "FROM users u JOIN role_grants rg ON rg.user_id = u.id WHERE (CAST(:gymId AS uuid) IS NULL OR rg.gym_id = :gymId) AND rg.role = 'TRAINER' "
                + "AND rg.revoked_at IS NULL AND (rg.is_gym_wide OR EXISTS (SELECT 1 FROM role_grant_locations rgl WHERE rgl.role_grant_id = rg.id "
                + "AND " + filter("rgl.location_id") + "))), days AS (SELECT generate_series(CAST(:fromDate AS date), "
                + "CAST(:toDate AS date) - 1, interval '1 day')::date AS day) SELECT d.day, t.id, t.name, "
                + "count(DISTINCT c.id), count(DISTINCT w.id) FROM days d CROSS JOIN trainers t "
                + "LEFT JOIN check_ins c ON c.user_id = t.id AND (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt AND c.occurred_at < :toAt "
                + "AND date_trunc('day', c.occurred_at AT TIME ZONE 'Asia/Kolkata')::date = d.day AND " + filter("c.location_id")
                + " LEFT JOIN workout_logs w ON w.trainer_user_id = t.id AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' "
                + "AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND date_trunc('day', w.performed_at AT TIME ZONE 'Asia/Kolkata')::date = d.day AND " + filter("w.location_id")
                + " GROUP BY d.day, t.id, t.name ORDER BY d.day, t.name";
        ZoneId businessZone = ZoneId.of("Asia/Kolkata");
        return jdbc.query(sql, params(gymId, locationId, from, to)
                .addValue("fromDate", from.toInstant().atZone(businessZone).toLocalDate())
                .addValue("toDate", to.toInstant().atZone(businessZone).toLocalDate()), (rs, n) ->
                new InsightsDtos.TrainerDailyActivity(rs.getObject(1, LocalDate.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getLong(4), rs.getLong(5)));
    }

    List<InsightsDtos.MemberActivity> members(UUID gymId, UUID locationId, Timestamp from, Timestamp to, String search, int limit) {
        String sql = "SELECT mr.user_id, mr.id, concat_ws(' ', u.first_name, u.last_name), u.state, m.state, m.expires_on, "
                + "(m.state = 'ACTIVE' AND m.expires_on >= CURRENT_DATE), mr.primary_location_id, "
                + "(SELECT count(*) FROM check_ins c WHERE c.user_id = mr.user_id AND (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND c.occurred_at >= :fromAt AND c.occurred_at < :toAt AND " + filter("c.location_id") + "), "
                + "(SELECT count(*) FROM workout_logs w WHERE w.user_id = mr.user_id AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND " + filter("w.location_id") + "), "
                + "(SELECT max(c.occurred_at) FROM check_ins c WHERE c.user_id = mr.user_id AND (CAST(:gymId AS uuid) IS NULL OR c.gym_id = :gymId) AND " + filter("c.location_id") + "), "
                + "(SELECT max(w.performed_at) FROM workout_logs w WHERE w.user_id = mr.user_id AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' AND " + filter("w.location_id") + "), "
                + "ta.trainer_user_id, concat_ws(' ', tu.first_name, tu.last_name) "
                + "FROM member_records mr JOIN users u ON u.id = mr.user_id LEFT JOIN memberships m ON m.id = (SELECT m2.id FROM memberships m2 WHERE m2.member_record_id = mr.id ORDER BY m2.created_at DESC LIMIT 1) "
                + "LEFT JOIN trainer_assignments ta ON ta.member_user_id = mr.user_id AND ta.gym_id = mr.gym_id AND ta.ended_at IS NULL LEFT JOIN users tu ON tu.id = ta.trainer_user_id "
                + "WHERE (CAST(:gymId AS uuid) IS NULL OR mr.gym_id = :gymId) AND " + filter("mr.primary_location_id") + " AND (:search = '' OR lower(concat_ws(' ', u.first_name, u.last_name, u.email, u.phone_e164)) LIKE lower('%' || :search || '%')) "
                + "ORDER BY 11 DESC NULLS LAST, 3 LIMIT :limit";
        return jdbc.query(sql, params(gymId, locationId, from, to).addValue("search", search == null ? "" : search.trim()).addValue("limit", limit), (rs, n) ->
                new InsightsDtos.MemberActivity(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getObject(6, LocalDate.class), rs.getBoolean(7), rs.getObject(8, UUID.class), rs.getLong(9), rs.getLong(10),
                        rs.getTimestamp(11) == null ? null : rs.getTimestamp(11).toInstant(), rs.getTimestamp(12) == null ? null : rs.getTimestamp(12).toInstant(),
                        rs.getObject(13, UUID.class) == null ? null : new InsightsDtos.Trainer(rs.getObject(13, UUID.class), rs.getString(14), null)));
    }

    InsightsDtos.MemberPerformance performance(UUID gymId, UUID locationId, UUID userId, Timestamp from, Timestamp to) {
        MapSqlParameterSource p = params(gymId, locationId, from, to).addValue("userId", userId);
        return jdbc.queryForObject("SELECT u.id, concat_ws(' ', u.first_name, u.last_name) FROM users u JOIN member_records mr ON mr.user_id = u.id AND (CAST(:gymId AS uuid) IS NULL OR mr.gym_id = :gymId) WHERE u.id = :userId AND " + filter("mr.primary_location_id"), p,
                (rs, n) -> new InsightsDtos.MemberPerformance(rs.getObject(1, UUID.class), rs.getString(2),
                        scalar("SELECT count(*) FROM workout_logs WHERE user_id = :userId AND (CAST(:gymId AS uuid) IS NULL OR gym_id = :gymId) AND status = 'COMPLETED' AND performed_at >= :fromAt AND performed_at < :toAt AND " + filter("location_id"), p),
                        scalar("SELECT coalesce(sum(duration_minutes), 0) FROM workout_logs WHERE user_id = :userId AND (CAST(:gymId AS uuid) IS NULL OR gym_id = :gymId) AND status = 'COMPLETED' AND performed_at >= :fromAt AND performed_at < :toAt AND " + filter("location_id"), p),
                        scalar("SELECT count(*) FROM workout_log_sets s JOIN workout_logs w ON w.id = s.workout_log_id WHERE w.user_id = :userId AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' AND s.completed AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND " + filter("w.location_id"), p),
                        jdbc.queryForObject("SELECT coalesce(sum(s.volume), 0) FROM workout_log_sets s JOIN workout_logs w ON w.id = s.workout_log_id WHERE w.user_id = :userId AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.status = 'COMPLETED' AND s.completed AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND " + filter("w.location_id"), p, BigDecimal.class),
                        jdbc.query("SELECT metric_type, recorded_on, value, unit FROM body_metrics WHERE user_id = :userId AND (CAST(:gymId AS uuid) IS NULL OR gym_id = :gymId) ORDER BY recorded_on DESC LIMIT 100", p,
                                (r, x) -> new InsightsDtos.MetricPoint(r.getString(1), r.getObject(2, LocalDate.class), r.getBigDecimal(3), r.getString(4))),
                        jdbc.query("SELECT w.id, w.title, w.performed_at, w.duration_minutes, w.status = 'COMPLETED', (SELECT count(*) FROM workout_log_sets s WHERE s.workout_log_id = w.id AND s.completed) FROM workout_logs w WHERE w.user_id = :userId AND (CAST(:gymId AS uuid) IS NULL OR w.gym_id = :gymId) AND w.performed_at >= :fromAt AND w.performed_at < :toAt AND " + filter("w.location_id") + " ORDER BY w.performed_at DESC LIMIT 100", p,
                                (r, x) -> new InsightsDtos.WorkoutPoint(r.getObject(1, UUID.class), r.getString(2), r.getTimestamp(3).toInstant(), r.getInt(4), r.getBoolean(5), r.getInt(6)))));
    }

    private static String filter(String column) {
        return LOCATION_FILTER.formatted(column);
    }

    private static MapSqlParameterSource params(UUID gymId, UUID locationId, Timestamp from, Timestamp to) {
        return new MapSqlParameterSource().addValue("gymId", gymId).addValue("locationId", locationId)
                .addValue("fromAt", from).addValue("toAt", to);
    }

    private static MapSqlParameterSource params(UUID gymId, UUID locationId) {
        return new MapSqlParameterSource().addValue("gymId", gymId).addValue("locationId", locationId);
    }

    private static MapSqlParameterSource params(UUID gymId, UUID locationId, LocalDate today, LocalDate soon) {
        return params(gymId, locationId).addValue("today", today).addValue("soon", soon);
    }

    private long scalar(String sql, MapSqlParameterSource params) {
        Number value = jdbc.queryForObject(sql, params, Number.class);
        return value == null ? 0 : value.longValue();
    }
}
