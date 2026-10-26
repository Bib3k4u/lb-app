/** Turns a display name into a URL-safe slug — used to pre-fill the gym and
 *  location slug fields from names people are typing anyway, so they never
 *  have to think up a URL-safe identifier from scratch. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
