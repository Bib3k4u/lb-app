package com.limitbeyond.platform.persistence;

import com.limitbeyond.platform.domain.SubscriptionPayment;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubscriptionPaymentRepository extends JpaRepository<SubscriptionPayment, UUID> {
    Optional<SubscriptionPayment> findByRecordedByUserIdAndIdempotencyKey(UUID recordedByUserId, String idempotencyKey);

    @Query("SELECT COALESCE(SUM(p.amountMinor), 0) FROM SubscriptionPayment p")
    long totalRevenueMinor();

    @Query("SELECT COALESCE(SUM(p.amountMinor), 0) FROM SubscriptionPayment p WHERE p.receivedOn >= :since")
    long revenueMinorSince(@Param("since") LocalDate since);

    /** Last N calendar months of revenue, most recent first — the small
     *  breakdown behind the Super Admin dashboard's revenue chart. */
    @Query(value = """
            SELECT to_char(date_trunc('month', received_on), 'YYYY-MM') AS month,
                   SUM(amount_minor) AS total_minor
            FROM subscription_payments
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT :months
            """, nativeQuery = true)
    List<MonthlyRevenueRow> monthlyRevenue(@Param("months") int months);

    interface MonthlyRevenueRow {
        String getMonth();

        long getTotalMinor();
    }
}
