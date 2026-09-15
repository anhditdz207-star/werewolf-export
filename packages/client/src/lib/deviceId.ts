const KEY = 'masoi_device_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A UUID generated once per browser and kept in localStorage forever — used
 * as a lightweight, no-account "friend code" since this project has no
 * server-side user database. */
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** Overrides the local device id with one derived from the Google account,
 * so the same Google account always gets the same Friend ID no matter which
 * browser/device it signs in from — instead of a random per-browser id. */
export function linkDeviceIdToGoogle(googleId: string): void {
  localStorage.setItem(KEY, `google-${googleId}`);
}
