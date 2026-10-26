/**
 * Offline outbox — enqueue, drain, retry.  ADR-06 / LB-ENG-1.0 §8.4.
 *
 * The flow: write locally, confirm in the UI immediately (~8ms), sync in the
 * background when the network allows. The user's experience of "instant" ends
 * at the local write; everything after it is invisible to them.
 *
 * Why retry is safe: every operation carries an idempotency key generated once
 * at enqueue. A network failure is ambiguous — the client cannot distinguish a
 * request that never arrived from one that succeeded but whose response was
 * lost. The key resolves it: the server stores it under a unique constraint and
 * returns the original result on replay, so retrying freely cannot duplicate.
 */
import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import { eq, and, or, isNull, lte, asc } from 'drizzle-orm';
import { db } from '../db';
import { outbox, type OutboxType, type OutboxRow } from '../db/schema';
import { api } from '../api/client';

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2_000;

let draining: Promise<void> | null = null;
let drainRequested = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastQueuedAt = 0;

function queueTimestamp(): string {
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  return new Date(lastQueuedAt).toISOString();
}

function scheduleDrain(delayMs: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drain();
  }, delayMs);
}

function uuid(): string {
  return Crypto.randomUUID();
}

/** Server endpoint per operation type. Keep in step with the backend routes. */
const ENDPOINTS: Record<OutboxType, (p: Record<string, unknown>) => string> = {
  CHECK_IN: (p) => `/locations/${p.locationId}/check-ins`,
  WORKOUT_LOG: () => `/workout-logs`,
  WORKOUT_STATE: (p) => `/me/workouts/${p.workoutId}/${p.complete ? 'complete' : 'reopen'}`,
  WORKOUT_SET_STATE: (p) => `/me/workouts/${p.workoutId}/sets/${p.setId}/${p.complete ? 'complete' : 'uncomplete'}`,
  WORKOUT_EXERCISE_COMPLETE: (p) => `/me/workouts/${p.workoutId}/exercises/${p.exerciseId}/complete`,
};

export interface OutboxEvent {
  type: OutboxType;
  state: 'SYNCED' | 'FAILED';
  payload: Record<string, unknown>;
  error?: string;
}

const listeners = new Set<(event: OutboxEvent) => void>();

export function onOutboxEvent(listener: (event: OutboxEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: OutboxEvent): void {
  listeners.forEach((listener) => listener(event));
}

/**
 * Queue an operation and return immediately. The caller updates the UI as if it
 * had succeeded, because from the user's point of view it has.
 */
export async function enqueue(
  type: OutboxType,
  payload: Record<string, unknown>,
): Promise<'SYNCED' | 'PENDING'> {
  const now = queueTimestamp();
  const id = uuid();

  await db.insert(outbox).values({
    id,
    idempotencyKey: uuid(), // ENG-8.1: once per OPERATION, never per attempt
    type,
    payload: JSON.stringify(payload),
    occurredAt: now, // preserved through the queue — FR-ATT-07
    attempts: 0,
    state: 'PENDING',
    createdAt: now,
  });

  await drain();
  const remaining = await db.select().from(outbox).where(eq(outbox.id, id));
  if (remaining[0]?.state === 'FAILED') {
    throw new Error(remaining[0].lastError ?? 'The server rejected this check-in.');
  }
  return remaining.length === 0 ? 'SYNCED' : 'PENDING';
}

/** Persist a user action, then let the network replay happen independently.
 * Unlike `enqueue`, this never waits for an HTTP request before returning. */
export async function enqueueDeferred(
  type: OutboxType,
  payload: Record<string, unknown>,
): Promise<void> {
  const now = queueTimestamp();
  await db.insert(outbox).values({
    id: uuid(),
    idempotencyKey: uuid(),
    type,
    payload: JSON.stringify(payload),
    occurredAt: now,
    attempts: 0,
    state: 'PENDING',
    createdAt: now,
  });
  void drain();
}

/** Submit everything currently pending. Safe to call often; self-serialising. */
export async function drain(): Promise<void> {
  if (draining) {
    // The running drain may already have taken its database snapshot. Ask it
    // to make one more pass so an item enqueued during that window is not
    // incorrectly left pending until the app is foregrounded again.
    drainRequested = true;
    return draining;
  }

  draining = (async () => {
    do {
      drainRequested = false;
      await drainOnce();
    } while (drainRequested);
  })().finally(() => {
    draining = null;
  });

  return draining;
}

async function drainOnce(): Promise<void> {
  const { isConnected } = await Network.getNetworkStateAsync();

  // `isInternetReachable` is often null while the device is still probing,
  // and can legitimately be false on a Wi-Fi LAN whose local backend is
  // reachable without public internet. Only skip the request when the device
  // is definitively disconnected from every network.
  if (isConnected === false) return;

  const nowIso = new Date().toISOString();
  const pending = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.state, 'PENDING'),
        or(isNull(outbox.nextAttemptAt), lte(outbox.nextAttemptAt, nowIso)),
      ),
    )
    .orderBy(asc(outbox.createdAt));

  for (const item of pending) {
    const ok = await submit(item);
    // A transport failure means the network is gone again; stop rather than
    // burning attempts on every queued row for the same reason.
    if (!ok) break;
  }
}

async function submit(item: OutboxRow): Promise<boolean> {
  const payload = JSON.parse(item.payload) as Record<string, unknown>;

  try {
    await api.post(
      ENDPOINTS[item.type](payload),
      { ...payload, occurredAt: item.occurredAt, deferred: true },
      { headers: { 'Idempotency-Key': item.idempotencyKey } }, // same key every time
    );
    await db.delete(outbox).where(eq(outbox.id, item.id));
    emit({ type: item.type, state: 'SYNCED', payload });
    return true;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    // 4xx is permanent: the server rejected the content, so retrying is futile.
    // Surface it to the user rather than silently discarding their check-in.
    if (status && status >= 400 && status < 500 && status !== 429) {
      await db
        .update(outbox)
        .set({ state: 'FAILED', lastError: describe(error) })
        .where(eq(outbox.id, item.id));
      emit({ type: item.type, state: 'FAILED', payload, error: describe(error) });
      return true; // permanent, but not a transport failure — keep draining
    }

    // 5xx, 429 or network: retry with exponential backoff.
    const attempts = item.attempts + 1;
    const permanentlyFailed = attempts >= MAX_ATTEMPTS;
    const retryDelay = BASE_BACKOFF_MS * 2 ** attempts;
    await db
      .update(outbox)
      .set({
        attempts,
        state: permanentlyFailed ? 'FAILED' : 'PENDING',
        lastError: describe(error),
        nextAttemptAt: new Date(Date.now() + retryDelay).toISOString(),
      })
      .where(eq(outbox.id, item.id));
    if (permanentlyFailed) emit({ type: item.type, state: 'FAILED', payload, error: describe(error) });
    else scheduleDrain(retryDelay);
    return false;
  }
}

function describe(error: unknown): string {
  const e = error as { response?: { status?: number; data?: { detail?: string } }; message?: string };
  return e.response?.data?.detail ?? (e.response?.status ? `HTTP ${e.response.status}` : (e.message ?? 'unknown'));
}

/** Rows the user needs to know about — shown as a banner, not swallowed. */
export async function failedItems(): Promise<OutboxRow[]> {
  return db.select().from(outbox).where(eq(outbox.state, 'FAILED'));
}

export async function pendingCount(): Promise<number> {
  const rows = await db.select().from(outbox).where(eq(outbox.state, 'PENDING'));
  return rows.length;
}

export interface PendingWorkoutAction {
  type: 'WORKOUT_STATE' | 'WORKOUT_SET_STATE' | 'WORKOUT_EXERCISE_COMPLETE';
  workoutId: string;
  setId?: string;
  exerciseId?: string;
  complete?: boolean;
}

/** Pending workout actions are replayed over freshly fetched server data so
 * an app restart cannot temporarily undo what the user already tapped. */
export async function pendingWorkoutActions(): Promise<PendingWorkoutAction[]> {
  const workoutTypes: PendingWorkoutAction['type'][] = ['WORKOUT_STATE', 'WORKOUT_SET_STATE', 'WORKOUT_EXERCISE_COMPLETE'];
  const rows = await db.select().from(outbox).where(eq(outbox.state, 'PENDING')).orderBy(asc(outbox.createdAt));
  return rows.filter((row) => workoutTypes.includes(row.type as PendingWorkoutAction['type'])).map((row) => {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    return {
      type: row.type as PendingWorkoutAction['type'],
      workoutId: String(payload.workoutId),
      ...(payload.setId ? { setId: String(payload.setId) } : {}),
      ...(payload.exerciseId ? { exerciseId: String(payload.exerciseId) } : {}),
      ...(typeof payload.complete === 'boolean' ? { complete: payload.complete } : {}),
    };
  });
}

export interface PendingCheckIn {
  id: string;
  locationId: string;
  method: string;
  purpose: string;
  occurredAt: string;
  distanceM: null;
  deferred: true;
  flagged: false;
  pendingSync: true;
}

/** Pending attendance is part of the visible history, even after a refetch or
 * app restart. It disappears only after the server has durably accepted it. */
export async function pendingCheckIns(): Promise<PendingCheckIn[]> {
  const rows = await db
    .select()
    .from(outbox)
    .where(and(eq(outbox.type, 'CHECK_IN'), eq(outbox.state, 'PENDING')));
  return rows.map((row) => {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    return {
      id: `pending-${row.id}`,
      locationId: String(payload.locationId),
      method: String(payload.method),
      purpose: String(payload.purpose ?? 'PERSONAL_WORKOUT'),
      occurredAt: row.occurredAt,
      distanceM: null,
      deferred: true,
      flagged: false,
      pendingSync: true,
    };
  });
}

export async function retryFailed(id: string): Promise<void> {
  await db
    .update(outbox)
    .set({ state: 'PENDING', attempts: 0, nextAttemptAt: null, lastError: null })
    .where(eq(outbox.id, id));
  void drain();
}

export async function discard(id: string): Promise<void> {
  await db.delete(outbox).where(eq(outbox.id, id));
}
