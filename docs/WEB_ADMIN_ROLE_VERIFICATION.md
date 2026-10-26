# Web admin role verification runbook

Run this after the backend is available at `http://localhost:8080` and the frontend is configured with the same API base. Use separate browser profiles so sessions cannot leak between roles.

## Session matrix

| Session | Expected console navigation | Expected mutations |
| --- | --- | --- |
| `SUPER_ADMIN` | Dashboard, Gyms, Locations only | Review/reject/activate/deactivate/reactivate/close gyms; approve/reject locations |
| `GYM_OWNER` | Overview, Members, Trainers, Approvals, Locations, Plans, Feedback | Gym-wide plan/location changes plus member/trainer operations |
| `LOCATION_ADMIN` | Overview, Members, Trainers, Approvals, Locations, Feedback | Member/trainer operations only at assigned locations; no plan or location mutation controls |

## Manual checks

1. Sign in with each role using a separate private browser profile.
2. Confirm the navigation items match the session matrix; a superadmin must not request `/admin/dashboard`.
3. For a location admin, confirm plan create/edit/delete and location create/edit/delete controls are absent.
4. For a location admin, open a member and verify trainer assignment, membership sale, and member deactivation/reactivation are available only for permitted locations.
5. For a superadmin, verify only platform data is loaded on initial render, then exercise gym review, activation, lifecycle, and location-review actions.
6. Confirm a cross-gym URL/header change is rejected by the backend rather than relying on hidden controls.
7. Refresh each page after every mutation and confirm the updated status/count remains visible.

## Automated gates

```bash
cd frontend && npm run lint && npm run build
cd ../backend && ./mvnw -q -DskipTests package
./mvnw -q -Dtest=ArchitectureRulesTest test
./mvnw -q -Dtest='!LimitbeyondApplicationTests' test
./mvnw -q test # requires Docker/Testcontainers
```

The last command is intentionally not replaced with a narrower test: the Spring context, migrations, security wiring, and RLS integration must eventually be exercised together.
