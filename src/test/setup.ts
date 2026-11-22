import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(globalThis, 'jest', {
  value: {
    advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
  },
  configurable: true,
});
