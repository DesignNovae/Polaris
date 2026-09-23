// Runs before the application bundles: a missing root layout chunk prevents
// React error boundaries and effects from mounting at all.
export const CHUNK_RECOVERY_SCRIPT = String.raw`(() => {
  const key = 'polaris:chunk-recovery';
  let recovering = false;
  function ownChunk(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && url.pathname.startsWith('/_next/static/') && /\.js$/.test(url.pathname);
    } catch { return false; }
  }
  function recover() {
    if (recovering || navigator.onLine === false) return;
    try {
      const previous = Number(sessionStorage.getItem(key) || 0);
      const now = Date.now();
      if (previous && now - previous < 120000) return;
      sessionStorage.setItem(key, String(now));
    } catch { return; } // Without a durable guard, do not risk a reload loop.
    recovering = true;
    location.reload();
  }
  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target.tagName === 'SCRIPT' && ownChunk(target.src)) recover();
  }, true);
  window.addEventListener('unhandledrejection', event => {
    const error = event.reason;
    if (!error || error.name !== 'ChunkLoadError') return;
    const request = error.request || String(error.message || '').match(/https?:\/\/[^\s)]+/)?.[0];
    if (request && ownChunk(request)) recover();
  });
})();`;
