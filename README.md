# LIMITBEYOND

Multi-tenant gym and fitness management platform. Many gyms, each with many
locations, under one platform operator.

## Layout

| Folder      | What it is                                               |
| ----------- | -------------------------------------------------------- |
| `backend/`  | Java 21 + Spring Boot 4 modular monolith, PostgreSQL + RLS |
| `frontend/` | Next.js — public SEO zone and authenticated admin console  |
| `app/`      | React Native + Expo — all five roles, one application      |
| `docs/`     | SRS, architecture, engineering standards, data model       |

## Documents

Read these before changing anything structural. They are the authority; when
code and document disagree, one of them is a bug.

| Document | Fixes |
| --- | --- |
| `docs/LIMITBEYOND_SRS_v1.1.pdf` | What the system must do — ~200 numbered requirements |
| `docs/LIMITBEYOND_ARCH_v1.0.pdf` | Technology decisions, ADR-01 to ADR-15 |
| `docs/LIMITBEYOND_STANDARDS_v1.0.pdf` | How code is written, reviewed and enforced |
| `docs/LIMITBEYOND_DATAMODEL_v1.0.pdf` | 74 entities, every relationship and constraint |

`CLAUDE.md` is the condensed ruleset for AI coding assistants.

## Getting started

### Backend

```bash
cd backend
docker compose up -d          # PostGIS-enabled Postgres on :5432
cp .env.example .env
./mvnw spring-boot:run        # http://localhost:8080
```

Two database roles, and the distinction matters: `lb_migrator` owns the schema
and runs Flyway; `lb_app` owns nothing and serves requests. A table owner
bypasses Row-Level Security, so connecting as the owner would silently disable
every isolation guarantee in the platform.

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm run dev                   # http://localhost:3000
```

Public routes are statically generated with ISR and carry full metadata plus
JSON-LD built from database content. `/console/*` is authenticated,
client-rendered and `noindex`.

### Mobile

```bash
cd app
cp .env.example .env
npx expo start
```

On a physical device set `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP —
`localhost` resolves to the phone.

## The five non-negotiables

These fail silently: they compile, pass ordinary tests, and show no symptom
until it matters.

1. `SET LOCAL`, never bare `SET`, for RLS context
2. The application never connects as the table owner
3. Sensitive media never uses Cloudinary's default delivery type
4. Store `public_id`, never a full URL
5. Every tenant-scoped service method authorises before it acts

Full reasoning in `docs/LIMITBEYOND_STANDARDS_v1.0.pdf` §4.

## Current state

Scaffolded, compiling, and typechecking clean. Phase 1 implementation has not
started — see `docs/LIMITBEYOND_ARCH_v1.0.pdf` §14 for the build sequence.
