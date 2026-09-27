// Persist across reloads, tabs and browser restarts. Supabase rotates short-lived
// access tokens via the refresh token; admin authorization is checked server-side.
export const ADMIN_AUTH_KEY = 'mental-content-admin';
export function prepareAuthStorage(persistent, legacy) {
  const marker = `${ADMIN_AUTH_KEY}-persistent-storage-v1`;
  const previous = legacy.getItem(ADMIN_AUTH_KEY);
  if (!persistent.getItem(marker) && !persistent.getItem(ADMIN_AUTH_KEY) && previous) {
    persistent.setItem(ADMIN_AUTH_KEY, previous);
  }
  // An OAuth flow started before this deployment still needs its PKCE verifier.
  const verifier = `${ADMIN_AUTH_KEY}-code-verifier`;
  if (!persistent.getItem(verifier) && legacy.getItem(verifier)) {
    persistent.setItem(verifier, legacy.getItem(verifier));
  }
  persistent.setItem(marker, '1');
  legacy.removeItem(ADMIN_AUTH_KEY);
  legacy.removeItem(verifier);
  return persistent;
}
