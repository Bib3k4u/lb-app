# Web Admin Parity Plan

## Objective

Make the web console operationally equivalent to the mobile app for gym admins and superadmins. The web must use the existing backend contracts, enforce the same permissions, and expose the same workflows with clear loading, empty, error, and confirmation states.

## Phase 0 — Inventory and foundations

- [x] Inventory admin and superadmin screens and API calls in `app/src/app`.
- [x] Separate superadmin navigation from gym-admin navigation.
- [x] Keep superadmin platform reads independent from gym-scoped analytics.
- [x] Preserve shared session/error handling and production build checks.
- [x] Add a typed console API module for the first admin operations slice.

## Phase 1 — Gym-admin operations

- [x] Admin overview: attendance, member activity, trainer activity, recent check-ins.
- [x] Trainer activity drill-down: daily check-ins and completed-workout reporting.
- [x] Roster: view members/trainers, status, location and search filters.
- [x] Approvals: approve/reject pending accounts and assign an initial plan.
- [x] Membership plans: create, edit and delete plans.
- [x] Locations: create, edit and delete locations with GPS coordinates, QR token and approval state.
- [x] Member detail: progress, diet plan, trainer assignment, membership and account lifecycle.
- [x] Member nutrition: date-based logs, history, food search, macros and editable diet goals.
- [x] Trainer detail: role lifecycle, assigned members and activity.
- [x] Feedback inbox: threads, replies, edit, delete, resolve/reopen.
- [x] Admin-safe confirmations and permission-aware action visibility.

## Phase 2 — Superadmin operations

- [x] Dashboard: registered gyms, review queue, activation queue, active/rejected gyms.
- [x] Gyms: full registrant/business/location details, search, review, activation, deactivation and closure lifecycle.
- [x] Locations: review queue with approve/reject reason and full location details.
- [x] Subscription activation: default offering, payment recording and lifecycle activation.
- [x] Clear cross-gym scope and no accidental gym-level API calls.

## Phase 3 — Reliability and parity verification

- [x] Add consistent API error parsing and retry/refresh actions.
- [x] Add route-level loading and empty states for every operation.
- [ ] Verify role separation with superadmin, gym owner and location admin sessions.
- [x] Run frontend lint/build and backend compile/architecture tests.
- [ ] Run backend integration/context tests with Docker/Testcontainers available.
- [x] Document deployment and migration/restart requirements.

## Current implementation checkpoint

The main operational workflows are implemented in the web console, including gym registration review, activation and closure, gym-admin operations, location review, member/trainer management, feedback, and member nutrition history. The backend now explicitly rejects superadmin requests to the gym-scoped dashboard surface, with a focused unit test. Remaining work is restarting the live backend to load that guard, completing environment-backed role verification, and running the full context tests with Docker/Testcontainers.
