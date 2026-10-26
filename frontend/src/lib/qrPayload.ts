const QR_PREFIX = "limitbeyond://check-in?";

/**
 * Must byte-for-byte match app/src/lib/checkin/qrPayload.ts's
 * buildLocationQrPayload — the mobile app is what actually scans this, and
 * its parser only accepts this exact scheme.
 */
export function buildLocationQrPayload(locationId: string, token: string): string {
  return `${QR_PREFIX}locationId=${encodeURIComponent(locationId)}&token=${encodeURIComponent(token)}`;
}
