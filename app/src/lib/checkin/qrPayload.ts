const QR_PREFIX = 'limitbeyond://check-in?';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LocationQrPayload {
  locationId: string;
  token: string;
}

/** Human-opaque but scanner-readable payload printed for one location. */
export function buildLocationQrPayload(locationId: string, token: string): string {
  return `${QR_PREFIX}locationId=${encodeURIComponent(locationId)}&token=${encodeURIComponent(token)}`;
}

/** Reads the location from a printed QR. The fallback keeps compatibility
 * with the earlier token-only codes while locations replace their posters. */
export function parseLocationQrPayload(
  raw: string,
  fallbackLocationId: string | null | undefined,
): LocationQrPayload | null {
  if (!raw.startsWith(QR_PREFIX)) {
    return raw && fallbackLocationId ? { locationId: fallbackLocationId, token: raw } : null;
  }

  try {
    const values: Record<string, string> = {};
    for (const pair of raw.slice(QR_PREFIX.length).split('&')) {
      const [encodedKey, ...encodedValue] = pair.split('=');
      if (!encodedKey || encodedValue.length === 0) continue;
      values[decodeURIComponent(encodedKey)] = decodeURIComponent(encodedValue.join('='));
    }

    const locationId = values.locationId;
    const token = values.token;
    if (!locationId || !token || !UUID_PATTERN.test(locationId)) return null;
    return { locationId, token };
  } catch {
    return null;
  }
}
