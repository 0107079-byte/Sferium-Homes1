import { useEffect, useRef, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  fps: number;
  droppedFrames: number;
  renderCount: number;
  isLowEndDevice: boolean;
}

/**
 * usePerformanceProfile Hook
 * Automatically monitors runtime render performance, frame rate (FPS),
 * provides throttled time values to prevent React re-render thrashing,
 * and enables adaptive UI degradation under high-load multi-user conditions.
 */
export function usePerformanceProfile(componentName: string = 'Component') {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    droppedFrames: 0,
    renderCount: 0,
    isLowEndDevice: false,
  });

  const renderCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const droppedFramesRef = useRef(0);

  renderCountRef.current += 1;

  useEffect(() => {
    let animFrameId: number;

    const measureFps = () => {
      frameCountRef.current += 1;
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (delta >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / delta);
        if (currentFps < 45) {
          droppedFramesRef.current += (60 - currentFps);
        }

        setMetrics({
          fps: currentFps,
          droppedFrames: droppedFramesRef.current,
          renderCount: renderCountRef.current,
          isLowEndDevice: currentFps < 40,
        });

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animFrameId = requestAnimationFrame(measureFps);
    };

    animFrameId = requestAnimationFrame(measureFps);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  /**
   * Throttles high-frequency numeric updates (like video playback seconds)
   * to a smooth, GPU/CPU friendly rate (e.g. 200-250ms)
   */
  const useThrottledValue = <T>(value: T, intervalMs: number = 200): T => {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const lastUpdateRef = useRef<number>(Date.now());

    useEffect(() => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= intervalMs) {
        lastUpdateRef.current = now;
        setThrottledValue(value);
      } else {
        const timer = setTimeout(() => {
          lastUpdateRef.current = Date.now();
          setThrottledValue(value);
        }, intervalMs - (now - lastUpdateRef.current));
        return () => clearTimeout(timer);
      }
    }, [value, intervalMs]);

    return throttledValue;
  };

  return {
    metrics,
    useThrottledValue,
  };
}
