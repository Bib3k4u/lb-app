#!/usr/bin/env node
// Same endpoint as checkin-load.js, but every request reuses ONE fixed
// Idempotency-Key — after the first request creates the check-in, every
// subsequent request hits AttendanceService's idempotency short-circuit
// (a single lookup, no write). Deliberately separate from checkin-load.js
// so a fast replay number never gets mistaken for real write throughput.
//
// Usage:
//   source .fixture.env && node replay-load.js [duration_seconds] [connections]
"use strict";

const path = require("path");
const { execSync } = require("child_process");
const crypto = require("crypto");

const globalRoot = execSync("npm root -g").toString().trim();
const autocannon = require(path.join(globalRoot, "autocannon"));

const BASE = process.env.BASE || "http://localhost:8080/api/v1";
const LOCATION_ID = requireEnv("LOCATION_ID");
const MEMBER_ACCESS = requireEnv("MEMBER_ACCESS");
const LAT = parseFloat(process.env.LOCATION_LATITUDE || "12.9121");
const LON = parseFloat(process.env.LOCATION_LONGITUDE || "77.6446");

const duration = parseInt(process.argv[2] || "20", 10);
const connections = parseInt(process.argv[3] || "20", 10);
const fixedKey = crypto.randomUUID();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing $${name} — did you \`source .fixture.env\`? Run seed-fixture.sh first.`);
    process.exit(1);
  }
  return v;
}

const instance = autocannon(
  {
    url: `${BASE}/locations/${LOCATION_ID}/check-ins`,
    duration,
    connections,
    requests: [
      {
        method: "POST",
        path: `/api/v1/locations/${LOCATION_ID}/check-ins`,
        headers: {
          Authorization: `Bearer ${MEMBER_ACCESS}`,
          "Content-Type": "application/json",
          "Idempotency-Key": fixedKey,
        },
        body: JSON.stringify({
          method: "GEOFENCE",
          purpose: "PERSONAL_WORKOUT",
          latitude: LAT,
          longitude: LON,
          accuracyM: 5.0,
          deferred: false,
        }),
      },
    ],
  },
  (err, result) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log("\n=== POST /locations/{id}/check-ins (one fixed idempotency key — replay fast path) ===");
    console.log(
      `2xx: ${result["2xx"]}  non-2xx: ${result.non2xx}  errors: ${result.errors}  timeouts: ${result.timeouts}`
    );
    console.log(
      `latency ms  p50=${result.latency.p50} p90=${result.latency.p90} p99=${result.latency.p99} max=${result.latency.max}`
    );
    console.log(`req/sec   avg=${result.requests.average} max=${result.requests.max}`);
  }
);

autocannon.track(instance, { renderProgressBar: true });
