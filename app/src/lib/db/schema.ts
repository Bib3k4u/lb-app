/**
 * Local SQLite schema — the offline outbox and a small read cache.
 *
 * ADR-06: only check-in and workout logging are queued offline. Both are
 * NON-CONTENDING — a check-in is an append-only fact about one person at one
 * moment, and a workout log has exactly one author. Neither needs arbitration
 * against another user's concurrent action, so no conflict resolution is
 * required. Bookings and payments contend for shared resources and are
 * therefore always online, arbitrated by the server.
 *
 * Do not add a contended operation to this outbox without reading ADR-05 first.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const OUTBOX_TYPES = [
  'CHECK_IN',
  'WORKOUT_LOG',
  'WORKOUT_STATE',
  'WORKOUT_SET_STATE',
  'WORKOUT_EXERCISE_COMPLETE',
] as const;
export type OutboxType = (typeof OUTBOX_TYPES)[number];

export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),

  /**
   * Generated ONCE at enqueue and reused on every retry (ENG-8.1).
   * Generating a fresh key per attempt defeats the mechanism entirely: each
   * retry would look like a new operation and create a duplicate row server
   * side. The key belongs to the operation, not to the attempt — this single
   * field is what FR-ATT-05 rests on under offline replay.
   */
  idempotencyKey: text('idempotency_key').notNull().unique(),

  type: text('type', { enum: OUTBOX_TYPES }).notNull(),
  payload: text('payload').notNull(), // JSON

  /** The moment the user actually acted, preserved across the queue (FR-ATT-07). */
  occurredAt: text('occurred_at').notNull(),

  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: text('next_attempt_at'),
  lastError: text('last_error'),

  /** PENDING | FAILED — FAILED is surfaced to the user, never retried silently. */
  state: text('state', { enum: ['PENDING', 'FAILED'] }).notNull().default('PENDING'),

  createdAt: text('created_at').notNull(),
});

/**
 * Read cache for screens that must render without network: today's workout,
 * the timetable, the user's own profile. Deliberately a dumb key/value store —
 * TanStack Query owns freshness; this is only the cold-start fallback.
 */
export const cache = sqliteTable('cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON
  cachedAt: text('cached_at').notNull(),
  expiresAt: text('expires_at'),
});

export type OutboxRow = typeof outbox.$inferSelect;
export type NewOutboxRow = typeof outbox.$inferInsert;
