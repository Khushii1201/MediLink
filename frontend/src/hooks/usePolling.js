import { useEffect, useRef } from 'react';

export function usePolling(callback, intervalMs = 10000, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    let timer = null;

    function tick() {
      // Pause polling if user switched away from tab
      if (document.visibilityState !== 'hidden') {
        savedCallback.current?.();
      }
    }

    timer = setInterval(tick, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled]);
}
