# LIMITBEYOND — Project Instructions

Multi-tenant gym management platform. Many gyms, each with many locations.

**Stack:** Java 21 + Spring Boot 4 (modular monolith) · PostgreSQL 16 with RLS ·
React Native + Expo · Next.js · Cloudinary · Neon (dev, ap-southeast-1)

**Specs** — read before inventing anything:
- `docs/LIMITBEYOND_SRS_v1.1.pdf` — what the system must do
- `docs/LIMITBEYOND_ARCH_v1.0.pdf` — technology decisions, ADR-01..15
- `docs/LIMITBEYOND_STANDARDS_v1.0.pdf` — how code is written
- `docs/LIMITBEYOND_DATAMODEL_v1.0.pdf` — every table and relationship

## NEVER — these fail silently. No exception, no test failure, no symptom.

1. **NEVER use bare `SET` for RLS context. Always `SET LOCAL`, inside a
   transaction.** Connections are pooled; a plain `SET` persists after your
   request and leaks tenant context to the next one. This is a data breach,
   not a style issue.
2. **NEVER connect the application as the table owner.** `lb_app` owns nothing;
   `lb_migrator` owns the schema. Owners bypass RLS unless `FORCE` is set.
3. **NEVER upload media with Cloudinary's default `upload` type when it may be
   sensitive.** Receipts and ID documents use `authenticated`. All uploads go
   through `MediaService`, which requires a sensitivity argument.
4. **NEVER store a full Cloudinary URL.** Store `public_id`; build URLs at read
   time. There is no `url` column anywhere in the schema — keep it that way.
5. **NEVER write a tenant-scoped service method without
   `auth.require(permission, locationId)` as its first statement.**
6. **NEVER log** passwords, OTPs, tokens, full phone numbers, health screening
   or diet content. Log identifiers, never content.
7. **NEVER return 403 for a resource outside the caller's scope — return 404.**
   A 403 confirms existence and leaks another gym's data.
8. **NEVER call an external service** (Twilio, Cloudinary, Expo) inside a
   transaction. Enqueue a job instead.
9. **NEVER generate a fresh idempotency key per retry.** One key per operation.
10. **NEVER use floating point for money.** Integer minor units (paise) +
    currency.

## ALWAYS

- Create tables WITH their RLS policy in the same migration. `ENABLE` **and**
  `FORCE ROW LEVEL SECURITY`.
- Include `gym_id` and `location_id` on every operational table.
- `@Transactional` on service methods only — never controllers, never repos.
- Enqueue jobs inside the same transaction as the change that triggers them.
- Lock contended rows (session capacity, PT credits) with `lockForUpdate`.
- Enforce domain invariants in the domain object's constructor.
- Give every data screen loading / empty / error / success states.
- Name tests as sentences: `locationAdminCannotReadSiblingLocationMembers`.

## Repository layout

```
backend/    Spring Boot modular monolith (Maven)
frontend/   Next.js — public SEO zone + authenticated console
app/        React Native + Expo (expo-router, src/app)
docs/       SRS, architecture, standards, data model
```

## Backend modules

Ten: `platform`, `identity`, `org`, `people`, `billing`, `attendance`,
`scheduling`, `training`, `engagement`, `insights` (+ `shared`).

Only `api/` is public. `web/`, `domain/`, `internal/`, `persistence/` are
package-private. Cross-module access goes through the other module's facade
interface or a published event — Modulith verification fails the build
otherwise.

**`training` serves EVERY role, not just members.** That is FR-PFP-01. No method
in it takes a role parameter or branches on one. A Gym Owner logging their own
sets uses the identical code path a member does.

## Permissions

Five roles: `SUPER_ADMIN`, `GYM_OWNER`, `LOCATION_ADMIN`, `TRAINER`, `MEMBER`.

Authority is a set of grants, each scoped to a gym and named locations.
Effective authority = union of grants **evaluated per location** — never the
maximum applied everywhere. Trainer + Location Admin is a supported combination.

Super Admin has full operational reach across all gyms but **no data access
beyond a Gym Owner's**. Owning the platform confers reach, not depth.

**Progress photographs are out of scope.** Do not build upload, storage or
display for them. Progress tracking is weight, measurements, body fat, personal
records, volume trends and streaks only.

## Frontend zones

- **Public** (`/`, `/gyms/...`, `/classes/...`) — statically generated with ISR,
  full metadata, JSON-LD from database content. This is the SEO surface.
- **Console** (`/console/...`) — authenticated, client-rendered, `noindex`.
  Never server-render a page that mixes one gym's data into a cached response.

## Mobile

expo-router under `src/app`. Route files contain no logic. `(training)` is
mounted unconditionally for every account — never add a permission guard there.

Only check-in and workout logging are offline-capable, because they are the only
non-contending operations. Bookings and payments contend and must stay online.

## When unsure

Check the specs before inventing. If a requirement seems contradictory, say so
and ask — do not resolve it silently in code. If a rule above blocks something
that seems necessary, that is the signal to ask, not to work around it.
