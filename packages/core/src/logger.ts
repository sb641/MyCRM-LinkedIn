import pino from 'pino';
import { getEnv } from './env';

export function createLogger(name: string) {
  const env = getEnv();
  return pino({
    name,
    level: env.LOG_LEVEL,
    base: undefined,
    timestamp: false
  });
}
