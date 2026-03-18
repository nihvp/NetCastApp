import { useRef, useCallback } from 'react';

export const useThrottle = (callback, delay) => {
  const lastExecuted = useRef(0);

  return useCallback((...args) => {
    const now = Date.now();
    if (now >= lastExecuted.current + delay) {
      lastExecuted.current = now;
      callback(...args);
    }
  }, [callback, delay]);
};