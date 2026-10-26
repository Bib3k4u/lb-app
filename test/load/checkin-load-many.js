#!/usr/bin/env node
// The honest version of the flagship check-in write-path test: many
// DIFFERENT members, each checking in once per test run, round-robined
// across connections — see seed-many-members.sh's comment for why
// checkin-load.js (one member, fresh idempotency keys) actually measures
// the duplicate-check-in-window REJECTION path instead of real writes.
//
// Usage:
//   source .fixture.env
//   ./seed-many-members.sh 300        # once, or whenever you need more members
//   node checkin-load-many.js [duration_seconds] [connections]
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { mintAccessToken } = require("./mint-test-jwt");

const globalRoot = execSync("npm root -g").toString().trim();
const autocannon = require(path.join(globalRoot, "autocannon"));

const BASE = process.env.BASE || "http://localhost:8080/api/v1";
const GYM_ID = requireEnv("GYM_ID");
const LOCATION_ID = requireEnv("LOCATION_ID");
const LAT = parseFloat(process.env.LOCATION_LATITUDE || "12.9121");
const LON = parseFloat(process.env.LOCATION_LONGITUDE || "77.6446");

// Two modes: a duration-based run (arg 1 = seconds) mixes fresh writes with
// duplicate-check-in rejections once members run out, which is realistic
// for "what happens under sustained load with this many members" but not a
// clean write-only number. Passing "amount" as arg 1 instead caps the run
// at one request per seeded member (arg 2 = connections), so every request
// is a genuine fresh write — the number to use for "how fast can inserts
// happen," at the cost of a short, one-shot run.
const amountMode = process.argv[2] === "amount";
const duration = amountMode ? undefined : parseInt(process.argv[2] || "20", 10);
const connections = parseInt(process.argv[3] || "20", 10);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing $${name} — did you \`source .fixture.env\`?`);
    process.exit(1);
  }
  return v;
}

const membersFile = path.join(__dirname, ".members.txt");
if (!fs.existsSync(membersFile)) {
  console.error("No .members.txt — run ./seed-many-members.sh <count> first.");
  process.exit(1);
}
const memberIds = fs
  .readFileSync(membersFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
if (memberIds.length === 0) {
  console.error(".members.txt is empty — seed-many-members.sh found no rows. Check GYM_ID matches the seeded fixture.");
  process.exit(1);
}
console.log(`Loaded ${memberIds.length} distinct members.`);

const tokens = memberIds.map((userId) =>
  mintAccessToken(
    userId,
    "ACTIVE",
    [{ role: "MEMBER", gymId: GYM_ID, locationIds: [LOCATION_ID], gymWide: false }],
    15
  )
);

let counter = 0;

const instance = autocannon(
  {
    url: `${BASE}/locations/${LOCATION_ID}/check-ins`,
    ...(amountMode ? { amount: memberIds.length } : { duration }),
    connections,
    requests: [
      {
        method: "POST",
        path: `/api/v1/locations/${LOCATION_ID}/check-ins`,
        setupRequest: (request) => {
          // Round-robin: every request is a DIFFERENT member's first (and
          // only, for this run) check-in, so none of them collide with the
          // duplicate-check-in-window guard.
          const token = tokens[counter % tokens.length];
          counter += 1;
          request.headers["Authorization"] = `Bearer ${token}`;
          request.headers["Content-Type"] = "application/json";
          request.headers["Idempotency-Key"] = crypto.randomUUID();
          request.body = JSON.stringify({
            method: "GEOFENCE",
            purpose: "PERSONAL_WORKOUT",
            latitude: LAT,
            longitude: LON,
            accuracyM: 5.0,
            deferred: false,
          });
          return request;
        },
      },
    ],
  },
  (err, result) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`\n=== POST /locations/{id}/check-ins (${memberIds.length} distinct members, real writes) ===`);
    console.log(
      `2xx: ${result["2xx"]}  non-2xx: ${result.non2xx}  errors: ${result.errors}  timeouts: ${result.timeouts}`
    );
    console.log(
      `latency ms  p50=${result.latency.p50} p90=${result.latency.p90} p99=${result.latency.p99} max=${result.latency.max}`
    );
    console.log(`req/sec   avg=${result.requests.average} max=${result.requests.max}`);
    if (counter > memberIds.length) {
      console.log(
        `note: ${counter} requests were sent against only ${memberIds.length} members — some members were reused ` +
          `and their repeat requests measure the duplicate-check-in rejection path, not a fresh write. Seed more ` +
          `members (or shorten the run) for a cleaner number.`
      );
    }
  }
);

autocannon.track(instance, { renderProgressBar: true });
