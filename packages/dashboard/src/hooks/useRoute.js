import { useState, useEffect } from 'react';

export function useRoute() {
  const [path, setPath]   = useState(window.location.pathname);
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    function onPop() {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(to) {
    window.history.pushState({}, '', to);
    setPath(window.location.pathname);
    setSearch(window.location.search);
  }

  function getParam(key) {
    return new URLSearchParams(search).get(key);
  }

  return { path, search, navigate, getParam };
}
