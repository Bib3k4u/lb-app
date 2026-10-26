package com.limitbeyond.shared.security;

import java.util.List;

/**
 * One role grant as it travels inside a JWT (LB-API-1.0 §3.2). Deliberately
 * the same shape as {@code role_grants} + {@code role_grant_locations}
 * joined together, because the token exists precisely so a request never has
 * to hit the database to learn what its caller may do.
 */
public record RoleGrantClaim(String role, String gymId, List<String> locationIds, boolean gymWide) {
}
