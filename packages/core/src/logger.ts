import pino from 'pino';
import { getEnv } from './env';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(token|secret|password|cookie|api[_-]?key|session)/i;

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }

  return value;
}

export function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, REDACTED_VALUE];
      }

      return [key, redactValue(value)];
    })
  );
}

export function createLogger(name: string) {
  const env = getEnv();
  return pino({
    name,
    level: env.LOG_LEVEL,
    base: undefined,
    timestamp: false,
    formatters: {
      log(object) {
        return redactObject(object);
      }
    }
  });
}
