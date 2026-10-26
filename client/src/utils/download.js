/**
 * Downloads a file from the API (e.g. the CSV export).
 * A normal link cannot send our login token, so we fetch the file with the
 * token, then let the browser save it.
 * Throws an Error whose message is an error code (e.g. 'NETWORK_ERROR').
 */
import { getToken } from '../auth/session';

export async function downloadFile(path, fallbackName) {
  let response;
  try {
    response = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    throw new Error('NETWORK_ERROR');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.code || 'SERVER_ERROR');
  }

  // Use the file name the server suggests, if any.
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match ? match[1] : fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
