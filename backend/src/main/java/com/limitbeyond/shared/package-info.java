/**
 * Cross-cutting infrastructure: RLS context, the error model, JWT/security,
 * rate limiting, the job queue, OTP, media. Used by every business module,
 * which is the whole point of it — see LB-ENG-1.0's package layout for why
 * this stays a flat set of sub-packages rather than following the
 * web/internal/domain/persistence shape the ten business modules use.
 *
 * <p>Type.OPEN for the same reason as every other module's package-info —
 * see {@code attendance.package-info}'s fuller note. Without it (or without
 * this file existing at all, which is what let Modulith auto-detect
 * {@code com.limitbeyond.shared} as an implicit CLOSED module in the first
 * place) every one of {@code shared}'s sub-packages — {@code shared.rls},
 * {@code shared.error}, {@code shared.security} and the rest — would be
 * invisible to every business module that depends on them, which is all of
 * them.
 */
@org.springframework.modulith.ApplicationModule(
        displayName = "shared",
        type = org.springframework.modulith.ApplicationModule.Type.OPEN)
package com.limitbeyond.shared;
