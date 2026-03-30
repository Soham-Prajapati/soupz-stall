import { useState, useEffect, useCallback } from 'react';

const DAEMON_URL = import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533';

export function useModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('soupz_daemon_token') || '';
      const res = await window.fetch(`${DAEMON_URL}/api/models`, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setModels(data.models || (Array.isArray(data) ? data : []));
    } catch (err) {
      setError(err.message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, loading, error, refresh: fetchModels };
}
