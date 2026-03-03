import type { RegisteredAgent } from 'persais-core';

/**
 * Writing helper needs more iterations for complex multi-step
 * tasks like contradiction detection (search → compare → update).
 */
export const config: Partial<RegisteredAgent> = {
  maxIterations: 20,
};
