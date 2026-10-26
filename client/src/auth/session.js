/**
 * Saves the login session (token + basic user info) in localStorage so the
 * user stays logged in after a refresh.
 *
 * NOTE: the role stored here is only used to choose which pages to show.
 * The server checks the token and role again on every protected request,
 * so editing localStorage cannot give a user more access.
 */
const STORAGE_KEY = 'session';

// Reads the expiry time (in ms) from the token. A JWT is three base64url
// parts separated by dots; the middle part holds { id, role, exp }.
export function getTokenExpiry(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: nothing to clear
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage blocked: the user stays logged in until the page is refreshed
  }
}

/** Returns { token, user } or null if there is no valid, unexpired session. */
export function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (session?.token && session?.user && getTokenExpiry(session.token) > Date.now()) {
      return session;
    }
  } catch {
    // broken JSON or storage blocked: treat as logged out
  }
  clearSession();
  return null;
}

export function getToken() {
  return loadSession()?.token || null;
}
