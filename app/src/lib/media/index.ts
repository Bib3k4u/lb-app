/**
 * Media access. The client half of NN-3 and NN-4.
 *
 * NN-4: the app never stores or receives a full media URL. The API returns a
 * Cloudinary `publicId`; URLs are constructed here at render time. There is
 * nowhere in this app to put a full URL, which is what makes the rule
 * unbreakable rather than merely documented.
 *
 * NN-3: sensitive assets (receipts, identity documents) are NOT addressable by
 * constructed URL at all. They use Cloudinary's `authenticated` delivery type
 * and the app must ask the server for a signed, time-limited URL. That is why
 * `publicUrl` below refuses to build one.
 *
 * Progress photographs are out of scope entirely — do not add an upload path
 * for them (LB-ENG-1.0 §13).
 */
import { api } from '../api/client';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

export type Sensitivity = 'PUBLIC' | 'SENSITIVE';

export interface MediaRef {
  id: string;
  publicId: string;
  sensitivity: Sensitivity;
}

export interface TransformOptions {
  /** Always pass one. An unbounded image is a 12-megapixel download on 3G. */
  width: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'thumb';
}

/**
 * Build a delivery URL for a PUBLIC asset.
 *
 * `f_auto,q_auto` serves WebP or AVIF per device, which is most of the reason
 * ADR-15 chose Cloudinary: it satisfies CM-04 (3G-class connections) with no
 * application code beyond this line.
 */
export function publicUrl(media: MediaRef, opts: TransformOptions): string {
  if (media.sensitivity !== 'PUBLIC') {
    // Refusing loudly beats returning a URL that 404s or, far worse, one that
    // works and exposes a private asset.
    throw new Error(
      `NN-3 violation: ${media.publicId} is SENSITIVE. Use signedUrl() instead.`,
    );
  }

  const t = [
    'f_auto',
    'q_auto',
    `w_${opts.width}`,
    opts.height ? `h_${opts.height}` : null,
    opts.crop ? `c_${opts.crop}` : null,
  ]
    .filter(Boolean)
    .join(',');

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${t}/${media.publicId}`;
}

/**
 * Obtain a signed, time-limited URL for a SENSITIVE asset. Only the server can
 * issue this, and only after it has checked authorisation — which is the whole
 * point of NFR-SEC-07.
 */
export async function signedUrl(mediaId: string): Promise<string> {
  const { data } = await api.get<{ url: string; expiresAt: string }>(
    `/media/${mediaId}/signed-url`,
  );
  return data.url;
}

/**
 * Upload. Sensitivity is a REQUIRED argument, never defaulted — a caller that
 * has not thought about it cannot accidentally publish something private.
 */
export async function upload(
  uri: string,
  sensitivity: Sensitivity,
  purpose: 'AVATAR' | 'EXERCISE_DEMO' | 'GYM_LOGO' | 'RECEIPT' | 'ID_DOCUMENT',
): Promise<MediaRef> {
  const form = new FormData();
  form.append('file', {
    uri,
    name: uri.split('/').pop() ?? 'upload.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('sensitivity', sensitivity);
  form.append('purpose', purpose);

  const { data } = await api.post<MediaRef>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data; // publicId only — never a URL (NN-4)
}
