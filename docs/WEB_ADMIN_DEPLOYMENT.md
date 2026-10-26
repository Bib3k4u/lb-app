# Web admin deployment checklist

## Frontend

Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend API base, then run:

```bash
cd frontend
npm run lint
npm run build
npm run start
```

The console stores the OTP-verified session in browser storage and sends the bearer token to the backend. Serve it over HTTPS in production.

## Backend

Configure the database, JWT, OTP provider, and CORS settings in the backend environment. Build and start the backend with:

```bash
cd backend
./mvnw -DskipTests package
java -jar target/*.jar
```

Restart the backend after deploying backend or migration changes. Do not run the development superadmin seed profile in production; provision the superadmin through the production operator runbook.

## Verification gates

- Frontend lint and production build must pass.
- Backend package and architecture tests must pass.
- The non-context backend suite currently passes 19 tests; run the full backend context/integration tests with Docker/Testcontainers available.
- Verify separate sessions for SUPER_ADMIN, GYM_OWNER, and LOCATION_ADMIN before release.
- Follow the detailed [role verification runbook](./WEB_ADMIN_ROLE_VERIFICATION.md).

## Data safety

Database cleanup is destructive. Take a database backup and verify the preserved superadmin identity before any cleanup operation. Never use the development cleanup commands against production.
