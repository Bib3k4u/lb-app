// Mints an access token locally, matching JwtService.issueAccessToken's
// exact claim shape, signed with the SAME dev-only HS256 secret the backend
// trusts by default (application.yml's jwt.secret, unless JWT_SECRET is set
// in the environment the backend is running under — pass JWT_SECRET here
// too if you've overridden it).
//
// This exists ONLY to make load-testing many distinct members practical
// without an OTP round-trip per member (see seed-many-members.sh's
// comment). It is not a way to forge tokens against a real deployment —
// it only works because it's signing with a secret this same local backend
// was booted with.
"use strict";

const crypto = require("crypto");

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me-before-any-real-deploy-0123456789";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mintAccessToken(userId, state, grants, minutesValid) {
  const header = { alg: "HS256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    state,
    grants,
    iat: now,
    exp: now + minutesValid * 60,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(signingInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${signingInput}.${signature}`;
}

module.exports = { mintAccessToken };
