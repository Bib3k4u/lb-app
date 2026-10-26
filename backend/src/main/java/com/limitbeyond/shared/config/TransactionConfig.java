package com.limitbeyond.shared.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Explicit advisor ordering — the detail that makes {@code RlsContextAspect}
 * correct rather than merely present.
 *
 * <p>Spring resolves precedence between two advisors on the same join point
 * via {@link org.springframework.core.Ordered}: a LOWER value wraps OUTER
 * (its logic runs first on the way in), a HIGHER value sits INNER. Without an
 * explicit order here, the transaction advisor and {@code RlsContextAspect}
 * would both default to {@code Ordered.LOWEST_PRECEDENCE}, and their relative
 * sequencing would depend on incidental bean-registration order — exactly
 * the kind of ambiguity a security-critical mechanism cannot be built on.
 *
 * <p>Order 100 here is deliberately lower (more outer) than
 * {@code RlsContextAspect}'s {@code @Order(200)}: the transaction begins
 * first, and only then does the RLS aspect's {@code @Before} advice run its
 * {@code SET LOCAL} statements — inside a transaction that is now guaranteed
 * to exist. See {@code RlsContextAspect}'s class Javadoc for what goes wrong
 * if this ever regresses.
 */
@Configuration
@EnableTransactionManagement(order = 100)
@EnableAspectJAutoProxy(proxyTargetClass = true)
public class TransactionConfig {
}
