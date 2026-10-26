#!/usr/bin/env node
// Load-tests the flagship POST /locations/{id}/check-ins endpoint.
//
// Every request carries a FRESH, randomly-generated Idempotency-Key — this
// is what ENG-8.1 calls for in real usage (one key per real check-in event,
// reused only across THAT event's own retries), and it is what exercises
// the endpoint's real write path: idempotency lookup (miss), scope check,
// membership gate, duplicate-window check, geofence distance calc, insert,
// enqueue the RECALCULATE_STREAK job. A run that reused one key would just
// be measuring the idempotent-replay fast path instead — see replay-load.js
// for that, deliberately kept separate so the two numbers are never
// conflated.
//
// Usage:
//   source .fixture.env && node checkin-load.js [duration_seconds] [connections]
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
        },
        // Runs before EVERY request (not once per connection like
        // setupClient would) — this is what gives each one its own
        // Idempotency-Key, matching one-key-per-real-check-in.
        setupRequest: (request) => {
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
    printSummary("POST /locations/{id}/check-ins (fresh idempotency key per request)", result);
  }
);

autocannon.track(instance, { renderProgressBar: true });

function printSummary(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`2xx: ${result["2xx"]}  non-2xx: ${result.non2xx}  errors: ${result.errors}  timeouts: ${result.timeouts}`);
  console.log(
    `latency ms  p50=${result.latency.p50} p90=${result.latency.p90} p99=${result.latency.p99} max=${result.latency.max}`
  );
  console.log(`req/sec   avg=${result.requests.average} max=${result.requests.max}`);
}
