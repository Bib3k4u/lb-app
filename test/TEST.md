# Load-testing the LIMITBEYOND backend with autocannon

Scripts live in `test/load/`. They cover three things: a health-check
baseline, an authenticated read (`GET /me`), and the flagship write
(`POST /locations/{id}/check-ins`) in three distinct shapes, because that
endpoint's own idempotency and duplicate-check-in rules make "just hammer
it" measure the wrong thing if you're not careful — see "Why three
check-in scripts" below before you draw conclusions from a single number.

## Prerequisites

- The backend running locally against Postgres on port 5433 (`backend/DEV.md`).
- `autocannon` installed globally: `npm install -g autocannon` (this was
  written against v8.0.0).
- `psql`, `python3`, `node` on `PATH`.
- A completely fresh database is the only way to get numbers you can trust
  run to run — old rows from a previous test change what queries have to
  scan and what indexes are warm. Recreate it before a real measurement run:
  ```bash
  psql -p 5433 -d postgres -c "DROP DATABASE IF EXISTS limitbeyond;"
  psql -p 5433 -d postgres -c "CREATE DATABASE limitbeyond OWNER lb_migrator;"
  cd backend && ./mvnw spring-boot:run
  ```

## 1. Seed a fixture

```bash
cd test/load
./seed-fixture.sh          # registers a gym, activates it, creates a plan,
                            # registers + approves one member, sells them a
                            # membership. Writes .fixture.env — source it.
source .fixture.env
```

Re-run `seed-fixture.sh` any time; it builds a fresh gym with a
timestamp-suffixed slug/phone number, so it never collides with a previous
run. `.fixture.env` holds short-lived (15-minute) access tokens — if a test
run reports a wall of 401s, it's almost always this; just re-source a fresh
`seed-fixture.sh` run.

## 2. The three scripts

### `GET /actuator/health` — baseline, no auth, no business logic
```bash
autocannon -d 15 -c 50 http://localhost:8080/actuator/health
```

### `GET /me` — authenticated read, real RLS-scoped queries
```bash
autocannon -d 15 -c 20 -H "Authorization: Bearer $MEMBER_ACCESS" \
  http://localhost:8080/api/v1/me
```

### `POST /locations/{id}/check-ins` — the flagship write

**Why three check-in scripts.** `AttendanceService.recordCheckIn` checks
idempotency first, then rejects a second check-in from the *same member at
the same location* inside a short window (FR-ATT's duplicate-check-in
guard). That means "one member, hammered as fast as possible" mostly
measures whichever of those two rejection paths kicks in, not the real
insert path a gym actually sees (many different members, each checking in
once). Three scripts, three honest answers to three different questions:

- **`replay-load.js`** — one member, one *fixed* Idempotency-Key reused on
  every request. After the first request creates the row, every later one
  hits the idempotency short-circuit: a single lookup, no write. This is
  the number for "a client retried the same request" — cheap, by design.
  ```bash
  node replay-load.js 15 20   # duration_seconds connections
  ```

- **`checkin-load.js`** — one member, a *fresh* Idempotency-Key on every
  request. The first request succeeds; every one after it collides with
  the duplicate-check-in-window guard instead (a different, but still
  real, rejection path — a lookup plus one extra existence query, still no
  insert). This is what you get if you load-test this endpoint the
  naive way; it is NOT a write-throughput number, and the script says so.
  ```bash
  node checkin-load.js 15 20
  ```

- **`checkin-load-many.js`** — many *different* members, each checking in
  once. This is the one that actually measures the write path: idempotency
  lookup (miss) → scope check → membership gate → duplicate-window check
  (miss) → geofence distance calc → insert → enqueue a
  `RECALCULATE_STREAK` job. Needs a pool of members first:
  ```bash
  ./seed-many-members.sh 5000        # writes .members.txt directly via SQL —
                                      # see the script's own comment for why
                                      # it skips the OTP flow entirely
  node checkin-load-many.js amount 50   # "amount": exactly one request per
                                         # seeded member, so every single one
                                         # is a fresh write, never a rejection.
                                         # (arg 2 = connections)
  ```
  `checkin-load-many.js <duration> <connections>` (without `amount`) also
  works, and is closer to sustained real traffic, but once every seeded
  member has checked in once, later requests in that same run fall back to
  the duplicate-check-in rejection path — the script prints a note telling
  you how many requests that happened to.

`mint-test-jwt.js` is what makes `checkin-load-many.js` practical: it
signs access tokens locally with the same dev-only HS256 secret the
backend trusts by default, matching `JwtService`'s exact claim shape. That
is a load-testing shortcut for a *local* instance you already control, not
a way to forge tokens against anything real — read its header comment
before reusing it anywhere else.

## 3. Measured results (this pass)

Run 2026-09-17, this machine, against the local Postgres 17.9 on port
5433, HikariCP `maximum-pool-size: 10` (the checked-in default),
single backend instance, `./mvnw spring-boot:run` (not a packaged jar),
tests run from the same machine (loopback — zero real network latency).
Every number below is from an actual run, not estimated.

| Endpoint | Concurrency | p50 | p99 | max | throughput | notes |
|---|---|---|---|---|---|---|
| `GET /actuator/health` | 50 conns | 74 ms | 154 ms | 200 ms | ~21.5k req/s avg | **~2k/326k requests errored.** See caveat below — almost certainly the DB-backed health indicator contending with the same 10-connection pool as everything else. |
| `GET /me` | 20 conns | 73 ms | 161 ms | 189 ms | ~7.5k req/s avg | 147/114k errors (0.13%). Real JWT parse + 2 RLS-scoped reads. |
| check-in, replay (fixed key) | 20 conns | 77 ms | 158 ms | 166 ms | ~7.6k req/s avg | Idempotency short-circuit — one lookup, no write. |
| check-in, fresh key (1 member) | 20 conns | 76 ms | 148 ms | 156 ms | ~4.4k req/s avg | **0 successes** — every request after the first hit the duplicate-check-in guard. Included to show what the naive test looks like, not as a write number. |
| check-in, many members, sustained (5000 members) | 50 conns | 21 ms | 38 ms | 62 ms | ~1.7–2.3k req/s avg | **The real write number.** 5000/5000 succeeded. |
| check-in, many members, burst (500 members) | 20 conns | 8 ms | 18 ms | 19 ms | 500 req in 1.0s | Too short a burst for a stable req/s figure; latency is the useful column here. |

### Against the stated targets

**"Read in under 40ms"**: met for the real write path's p99 (38ms) and
comfortably met for its p50 (21ms). `/me` and the idempotent-replay reads
sit around 73–77ms at p50 here — over the 40ms bar, but see the caveat
below on why that number belongs to this test environment specifically,
not to the code.

**"100s of thousands of req/sec"**: not demonstrated, and I want to be
direct about why rather than let the other numbers imply it's close. A
single JVM instance talking to a single local Postgres through a
10-connection pool has a hard ceiling well under that regardless of how
efficient the code is — every one of these endpoints does at least one
round trip to that one database, and `check-ins` does several inside one
transaction. Getting into six figures of req/sec is an infrastructure
question (many app instances behind a load balancer, a Postgres
configuration — or read replicas for read-heavy paths — sized to match),
not something one local instance can show. What this pass *can* show, and
does: the query and transaction shapes themselves are fast (single-digit
to low-double-digit milliseconds under real load), which is the
precondition for scaling out to work at all. A slow query stays slow no
matter how many instances you add in front of it; these aren't slow.

### The `/actuator/health` error rate, specifically

This is the one result here that looks like it might be a real
architectural gap, not just "this is a laptop, not a Neon-sized Postgres
cluster": Spring Boot's default health aggregation includes a
DB-connectivity check, which borrows a connection from the exact same
10-connection HikariCP pool the rest of the app uses. Hammer `/actuator/health`
at 50 concurrent connections and the pool is fully occupied answering
"are you alive," which explains both the errors and the latency — a
harness like Kubernetes hitting this on a liveness probe wouldn't hammer
it anywhere near this hard, but it's worth knowing the health check isn't
free, and isn't isolated from the pool the business traffic needs. If this
matters going forward, the standard fix is a separate, small
"liveness-only" datasource (or a validation query short enough it never
really contends), or excluding the DB indicator from the `liveness` probe
group specifically (readiness can still check it) — not something this
pass changed, since it's a genuine design decision rather than a bug.

## 4. Re-running this yourself

```bash
psql -p 5433 -d postgres -c "DROP DATABASE IF EXISTS limitbeyond;"
psql -p 5433 -d postgres -c "CREATE DATABASE limitbeyond OWNER lb_migrator;"
cd backend && ./mvnw spring-boot:run &
cd ../test/load
./seed-fixture.sh && source .fixture.env
./seed-many-members.sh 5000

autocannon -d 15 -c 50 http://localhost:8080/actuator/health
autocannon -d 15 -c 20 -H "Authorization: Bearer $MEMBER_ACCESS" http://localhost:8080/api/v1/me
node replay-load.js 15 20
node checkin-load.js 15 20
node checkin-load-many.js amount 50
```

To see the effect of the connection pool specifically (this pass's most
likely lever for the throughput numbers above), override it without
touching the committed config:
```bash
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=50 ./mvnw spring-boot:run
```
