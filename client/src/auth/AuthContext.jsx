/**
 * Login state for the whole app.
 * Use the useAuth() hook (useAuth.js) to get { user, login, logout, register, updateUser, replaceToken }.
 *   user: { id, role, name, username } or null when logged out
 */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, setUnauthorizedHandler } from '../api/client';
import { clearSession, getTokenExpiry, loadSession, saveSession } from './session';
import { disconnectSocket } from '../realtime/socket';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(loadSession);

  /**
   * Logs out: deletes the token and goes to the login page.
   *   noticeCode: optional error code to show there (e.g. 'SESSION_EXPIRED')
   * When the user chose to log out (no noticeCode), the server is told too, so
   * this token stops working everywhere. (Plain fetch: if the token was already
   * refused, there is nothing to end and no "unauthorized" loop.)
   */
  const logout = useCallback(
    (noticeCode) => {
      const isForced = typeof noticeCode === 'string';
      const token = loadSession()?.token;
      if (!isForced && token) {
        fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
      clearSession();
      disconnectSocket(); // stop receiving this account's live chat
      setSession(null);
      navigate('/login', { replace: true, state: isForced ? { notice: noticeCode } : undefined });
    },
    [navigate],
  );

  /** Logs in and returns the user, or throws an ApiError. */
  const login = useCallback(async (username, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    const newSession = { token: data.token, user: data.user };
    saveSession(newSession);
    setSession(newSession);
    return data.user;
  }, []);

  /** Creates a resident account, or throws an ApiError. */
  const register = useCallback(
    (form) => apiRequest('/auth/register', { method: 'POST', body: form, auth: false }),
    [],
  );

  /** Replaces the saved user info (e.g. after the name is changed in Profile). */
  const updateUser = useCallback((user) => {
    setSession((current) => {
      if (!current) return current;
      const updated = { ...current, user };
      saveSession(updated);
      return updated;
    });
  }, []);

  /** Saves a new token (after a password change the server ends the old ones). */
  const replaceToken = useCallback((token) => {
    setSession((current) => {
      if (!current) return current;
      const updated = { ...current, token };
      saveSession(updated);
      return updated;
    });
  }, []);

  // If the server rejects our token later, log out with that reason.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Log out automatically when the token expires while the page is open.
  useEffect(() => {
    if (!session) return undefined;
    const msLeft = getTokenExpiry(session.token) - Date.now();
    const timer = setTimeout(() => logout('SESSION_EXPIRED'), Math.max(msLeft, 0));
    return () => clearTimeout(timer);
  }, [session, logout]);

  const value = useMemo(
    () => ({ user: session?.user || null, login, logout, register, updateUser, replaceToken }),
    [session, login, logout, register, updateUser, replaceToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
