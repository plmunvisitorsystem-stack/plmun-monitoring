/**
 * Loads data from the API when a page opens.
 *
 *   const { data, loading, errorCode, reload } = useApiData('/resident/reports');
 *
 * - loading:   true while waiting for the server
 * - errorCode: e.g. 'NETWORK_ERROR' (translate with t(`errors.${errorCode}`))
 * - reload():  try again (for a "Try Again" button)
 */
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export function useApiData(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Ignore the answer if the user already left the page (or the path changed).
    let active = true;
    setLoading(true);
    setErrorCode(null);

    apiRequest(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setErrorCode(error.code);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  return { data, loading, errorCode, reload };
}
