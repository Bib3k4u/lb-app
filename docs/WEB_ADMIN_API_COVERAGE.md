# Web admin API coverage

This matrix maps the mobile admin/superadmin operations to the web console. The web uses the same authenticated `/api/v1` contracts and sends the selected gym through `X-Gym-Id` for gym-scoped requests.

Permission split in the web console follows the mobile/backend contract: `SUPER_ADMIN` sees only platform dashboard, gyms, and locations; `GYM_OWNER` and gym-wide grants can mutate plans and locations; `GYM_OWNER` and `LOCATION_ADMIN` can manage member/trainer operations at permitted locations.

| Workflow | API coverage | Web surface | Status |
| --- | --- | --- | --- |
| Gym admin overview | `/admin/dashboard`, `/admin/dashboard/members`, `/admin/dashboard/trainers/daily` | Overview, member activity, recent check-ins, trainer daily table | Complete |
| Roster | `/roster`, `/roster/{userId}/deactivation`, `/roster/{userId}/reactivation` | Role/location filters, lifecycle actions | Complete |
| Approvals | `/verifications/pending`, `/verifications/{userId}`, `/plans` | Approval queue and initial member plan | Complete |
| Plans | `/plans`, `POST/PUT/DELETE /plans/{id}` | Plan catalogue with permission-aware mutations | Complete |
| Locations | `/locations`, `POST/PUT/DELETE /locations/{id}`, `/locations/{id}/qr-token` | Location form, GPS fields, QR token, approval state | Complete |
| Member profile | `/users/{id}/progress`, `/users/{id}/diet-plan`, `/users/{id}/diet-plans`, trainer and membership endpoints | Performance, diet, trainer assignment, membership and account access | Complete |
| Member nutrition | `/users/{id}/nutrition`, `/users/{id}/nutrition/history`, nutrition entries, food search | Date log, history, food lookup, macros, entry editing/removal, diet goals | Complete |
| Trainer profile | `/roster`, `/locations/{id}/trainers`, roster lifecycle | Trainer detail and assigned members | Complete |
| Feedback | Location feedback, response, state, update and delete endpoints | Inbox, filters, replies, edit, delete, resolve/reopen | Complete |
| Superadmin dashboard | `/platform/gyms`, default offering, location review queue | Platform metrics, queue shortcuts and locations | Complete |
| Superadmin gym review | Gym verification, rejection, subscription activation | Full business/registrant/location review and explicit rejection reason | Complete |
| Superadmin lifecycle | Gym deactivation, reactivation and close | Confirmed lifecycle controls and closed state | Complete |

## Verification status

- Frontend lint and production build pass.
- Backend package and architecture tests pass.
- 19 non-context backend tests pass, including the explicit superadmin gym-dashboard guard.
- The Spring context test still requires a running Docker/Testcontainers environment.
- Separate live sessions for `SUPER_ADMIN`, `GYM_OWNER`, and `LOCATION_ADMIN` remain the final runtime verification gate.
