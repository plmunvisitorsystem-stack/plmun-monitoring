/**
 * Small helper for calling the Express API.
 *
 *   const data = await apiRequest('/auth/login', { method: 'POST', body: {...}, auth: false });
 *
 * - Adds the login token automatically (unless auth: false).
 * - Throws an ApiError with a "code" (e.g. 'INVALID_CREDENTIALS') that pages
 *   translate with t(`errors.${code}`).
 */
import { getToken } from '../auth/session';

export class ApiError extends Error {
  constructor(status, code, fields = {}, data = null) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields; // field-level error codes, e.g. { username: 'USERNAME_TAKEN' }
    this.data = data; // the whole answer (e.g. LIVE_CHAT_CLOSED includes the chat schedule)
  }
}

// AuthContext registers a function here so an expired or rejected token
// logs the user out from anywhere in the app.
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const token = auth ? getToken() : null;
  const headers = {};
  // FormData (e.g. a report with photos) is sent as multipart/form-data;
  // the browser sets that Content-Type itself. Everything else is JSON.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    // The request never reached the server (offline, server stopped...).
    throw new ApiError(0, 'NETWORK_ERROR');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null; // not JSON (e.g. the dev proxy could not reach the API)
  }

  if (!response.ok) {
    const code = data?.code || 'NETWORK_ERROR';
    // Our token was rejected: end the session.
    if (token && onUnauthorized && (response.status === 401 || code === 'ACCOUNT_INACTIVE')) {
      onUnauthorized(code);
    }
    throw new ApiError(response.status, code, data?.fields, data);
  }

  return data;
}

/**
 * Loads a report photo with the login token and returns a temporary URL for
 * <img src>. (A plain <img src="/api/photos/1"> cannot send the token.)
 * Call URL.revokeObjectURL(url) when the photo is no longer shown.
 */
export function fetchPhotoUrl(photoId) {
  return fetchImageUrl(`/api/photos/${photoId}`);
}

/** Same as fetchPhotoUrl for any image URL of the API (e.g. a featured case's photo). */
export async function fetchImageUrl(url) {
  const token = getToken();
  let response;
  try {
    response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.code || 'NETWORK_ERROR');
  }
  return URL.createObjectURL(await response.blob());
}
