package com.limitbeyond.shared.rls;

/**
 * Carries the current request's {@link AuthContext} across the call stack.
 *
 * <p>Backed by a plain {@code ThreadLocal}. This is safe under virtual
 * threads: {@code spring.threads.virtual.enabled=true} gives each HTTP
 * request its own disposable virtual thread, and the whole request —
 * security filter, controller, service, RLS aspect — runs on that one
 * thread without hopping. Virtual threads are not pooled and reused the way
 * platform threads are, so there is no cross-request leakage risk; the
 * {@code clear()} call in the security filter's {@code finally} block is
 * defensive belt-and-braces, not load-bearing.
 */
public final class AuthContextHolder {

    private static final ThreadLocal<AuthContext> CURRENT = new ThreadLocal<>();

    private AuthContextHolder() {
    }

    public static void set(AuthContext context) {
        CURRENT.set(context);
    }

    /**
     * Never null. An unauthenticated request (no filter ran, or the filter
     * found no token) resolves to {@link AuthContext#anonymous()}, which
     * pushes null/false/empty into every {@code SET LOCAL} — the fail-closed
     * behaviour ENG-06 asks for: RLS policies then match nothing rather than
     * everything.
     */
    public static AuthContext get() {
        AuthContext ctx = CURRENT.get();
        return ctx != null ? ctx : AuthContext.anonymous();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
