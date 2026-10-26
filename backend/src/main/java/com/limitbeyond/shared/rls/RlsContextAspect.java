package com.limitbeyond.shared.rls;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Pushes the caller's authority into the database session so Row-Level
 * Security can filter every query. This is the load-bearing security control
 * of the whole platform (ADR-04) and the easiest thing in it to get subtly,
 * silently wrong.
 *
 * <h2>NN-1 — {@code SET LOCAL}, never {@code SET}</h2>
 *
 * Connections are pooled. A plain {@code SET} persists on the connection
 * after this request completes, so the <em>next</em> request — potentially
 * serving a different gym — inherits this tenant's context and reads their
 * data. That is a cross-tenant breach, not a style preference.
 * {@code SET LOCAL} is scoped to the transaction and discarded on commit or
 * rollback, which is the only reason connection pooling is safe here.
 *
 * <h2>NN-2 — the application must not own the tables</h2>
 *
 * A table owner bypasses RLS policies by default. Migrations run as
 * {@code lb_migrator}; the application connects as {@code lb_app}, which
 * owns nothing. Every table also carries {@code FORCE ROW LEVEL SECURITY}.
 *
 * <h2>Why this advice runs strictly after the transaction begins</h2>
 *
 * {@code @Before} advice with a HIGHER {@link Order} value than the
 * transaction advisor (see {@code TransactionConfig}, order 100 vs this
 * class's order 200) sits <em>inside</em> the transactional proxy: on the way
 * in, the outer (lower-order) advisor's logic runs first, so the transaction
 * has already begun by the time this advice's {@code SET LOCAL} statements
 * execute. Getting this backwards is not a cosmetic bug — {@code SET LOCAL}
 * outside an active transaction is silently discarded, and every policy in
 * the database would then match nothing (fail closed, but loud only in a
 * test that checks for it, not in a demo that happens to work once).
 *
 * <h2>Failing closed</h2>
 *
 * Policies read {@code current_setting('app.gym_id', true)} — the second
 * argument makes a missing setting resolve to NULL rather than raising. A
 * NULL comparison matches no rows, so a request that somehow reached the
 * database with no context returns empty rather than unfiltered (ENG-06).
 *
 * <h2>Why this fires once per transaction, not once per repository call</h2>
 *
 * Spring Data JPA wires {@code @Transactional} into its repository proxies
 * through its own internal machinery, not through annotation discovery on
 * the repository interface or {@code SimpleJpaRepository} as seen by the
 * standard auto-proxy creator — so this aspect's pointcut never matches
 * repository methods, and this advice fires only for the {@code @Service}
 * -level method that opens the transaction. That is exactly enough: the
 * {@code set_config(..., true)} calls in {@link RlsContext#reapply()} persist
 * for the whole transaction, so one correct firing at the start covers every
 * statement inside it. The failure mode this created in practice: code that
 * changed {@link AuthContextHolder} PARTWAY through an already-open
 * transaction (to bootstrap a just-created gym, or a just-authenticated user)
 * saw no effect, because this advice had already fired — once — before that
 * code ran, using whatever context existed at method entry. Anywhere that
 * needs to change context mid-transaction must call
 * {@link RlsContext#reapply()} itself right after updating the holder; see
 * {@code PlatformService.registerGym} and {@code AuthService.verifyOtp} for
 * the pattern.
 */
@Aspect
@Component
@Order(200)
public class RlsContextAspect {

    private final RlsContext rlsContext;

    public RlsContextAspect(RlsContext rlsContext) {
        this.rlsContext = rlsContext;
    }

    @Before("@annotation(org.springframework.transaction.annotation.Transactional)"
            + " || @within(org.springframework.transaction.annotation.Transactional)")
    public void applyContext() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            // Should be structurally impossible given the ordering above; if this
            // ever fires, treat it as the first thing to investigate — a bare SET
            // could otherwise be one config change away (NN-1).
            throw new IllegalStateException(
                    "RlsContextAspect ran without an active transaction — "
                            + "SET LOCAL would be silently discarded. Check TransactionConfig ordering.");
        }
        rlsContext.reapply();
    }
}
