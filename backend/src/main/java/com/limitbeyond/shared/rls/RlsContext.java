package com.limitbeyond.shared.rls;

import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Pushes whatever {@link AuthContextHolder} currently holds into the
 * database session's GUCs, via {@code set_config(..., true)} (NN-1: the
 * {@code true} is {@code is_local}, i.e. {@code SET LOCAL} semantics —
 * scoped to the current transaction, discarded on commit or rollback).
 *
 * <p>{@link RlsContextAspect} calls this automatically, once, at the entry
 * to whichever {@code @Transactional} method opens a given transaction. Code
 * that reassigns {@link AuthContextHolder} LATER, inside that same already-open
 * transaction (a bootstrap context for a row that doesn't exist until this
 * transaction creates it; the identity of a user this very request is
 * authenticating), must call {@link #reapply()} itself immediately after —
 * the aspect does not fire again for nested repository calls, so nothing else
 * will push the change to the database. See {@code RlsContextAspect}'s
 * Javadoc for why.
 */
@Component
public class RlsContext {

    private final JdbcTemplate jdbc;

    public RlsContext(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void reapply() {
        AuthContext ctx = AuthContextHolder.get();

        // NN-1, and a correctness detail beneath it: plain `SET LOCAL key = value`
        // is a Postgres utility statement whose value position does not accept a
        // JDBC bind parameter — it must be a literal known at parse time. The
        // correct, standard way to parameterize a GUC is the set_config(name,
        // value, is_local) function, called through an ordinary parameterized
        // SELECT.
        jdbc.query(
                "SELECT set_config('app.user_id', ?, true),"
                        + " set_config('app.gym_id', ?, true),"
                        + " set_config('app.location_ids', ?, true),"
                        + " set_config('app.gym_wide', ?, true),"
                        + " set_config('app.is_super_admin', ?, true)",
                rs -> null,
                asText(ctx.userId()),
                asText(ctx.gymId()),
                ctx.locationIdsCsv(),
                String.valueOf(ctx.gymWide()),
                String.valueOf(ctx.superAdmin()));
    }

    private static String asText(Object value) {
        return value == null ? null : value.toString();
    }

    /**
     * Runs {@code action} under a Super-Admin-level bypass, then restores
     * whatever context was active before.
     *
     * <p>For narrow, existence/state-only reads that a caller with no
     * established gym scope legitimately needs to make — "is gym X live",
     * "does location Y belong to gym X" — where the answer is a bare
     * boolean, not gym data, and the caller (e.g. a prospective member
     * completing registration against a gym they already know the id of)
     * has no gym-scoped {@link AuthContext} yet for RLS to key off of. Not a
     * general licence to skip RLS for convenience — see
     * {@code GymFacadeImpl}/{@code LocationFacadeImpl} for the only current
     * uses.
     */
    public <T> T withSystemBypass(Supplier<T> action) {
        AuthContext original = AuthContextHolder.get();
        AuthContextHolder.set(AuthContext.superAdmin(null));
        reapply();
        try {
            return action.get();
        } finally {
            AuthContextHolder.set(original);
            reapply();
        }
    }
}
