import { createLogger, getFeatureFlags } from '@mycrm/core';

const logger = createLogger('worker');

export function startWorker() {
  const flags = getFeatureFlags();
  logger.info({ flags }, 'worker booted');
  return {
    status: 'idle' as const,
    flags
  };
}

if (process.env.NODE_ENV !== 'test') {
  startWorker();
}
