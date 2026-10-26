# Local development database

This machine already has a full PostgreSQL 18 (the EnterpriseDB desktop
installer) bound to port 5432 and owned by a locked-down `postgres` system
user. Rather than touch it, LIMITBEYOND's dev Postgres runs on **5433** via
Homebrew, fully under your own account.

## One-time setup

```bash
brew install postgresql@17 postgis   # postgis pulls in gdal; a few minutes
```

Homebrew's `postgresql@17` defaults to port 5432 too, so it's reconfigured to
5433 before first start:

```bash
echo "port = 5433" >> /opt/homebrew/var/postgresql@17/postgresql.conf
brew services start postgresql@17
```

Create the two roles the architecture requires (NN-2 — the application must
never connect as the table owner) and the database:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

psql -h localhost -p 5433 -U "$(whoami)" -d postgres <<'SQL'
CREATE ROLE lb_migrator LOGIN PASSWORD 'lb_migrator' CREATEDB SUPERUSER;
CREATE ROLE lb_app LOGIN PASSWORD 'lb_app';
CREATE DATABASE limitbeyond OWNER lb_migrator;
SQL
```

`lb_migrator` is a local superuser purely so it can `CREATE EXTENSION`
(postgis, btree_gist, pgcrypto, citext) without further role grants — in a
managed Postgres (RDS, Neon) the platform itself grants extension privileges
and `lb_migrator` doesn't need to be a superuser there. What must hold in
every environment is the other half: **`lb_app` owns nothing**, which is what
makes Row-Level Security unbypassable (NN-2).

Flyway (running as `lb_migrator`) creates the extensions, both database
roles' privileges, every table, and every RLS policy on first boot:

```bash
cd backend
cp .env.example .env
./mvnw spring-boot:run
```

## Verifying it worked

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
psql -h localhost -p 5433 -U lb_migrator -d limitbeyond -c "\dx"     # 5 extensions
psql -h localhost -p 5433 -U lb_migrator -d limitbeyond -c "\dt"     # tables
curl -s localhost:8080/actuator/health | python3 -m json.tool
```

## Day to day

```bash
brew services start postgresql@17     # after a reboot
brew services stop postgresql@17      # when you're done
```

`brew services list` should show `postgresql@17` and nothing else claiming
port 5432 / 5433 confusion — if `psql` on port 5433 ever prompts for a
password unexpectedly, check `lsof -nP -iTCP:5433 -sTCP:LISTEN` first; it
usually means something else grabbed the port before Homebrew's instance did.
