import { z } from 'zod';

const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .default('false');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('file:./.mycrm/mycrm.sqlite'),
  GEMINI_API_KEY: z.string().optional().default(''),
  ENABLE_AI: booleanFlag,
  ENABLE_AUTOMATION: booleanFlag,
  ENABLE_REAL_BROWSER_SYNC: booleanFlag,
  ENABLE_REAL_SEND: booleanFlag,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(input);
}

export function getEnv(): AppEnv {
  return parseEnv(process.env);
}

export function getFeatureFlags() {
  const env = getEnv();
  return {
    ENABLE_AI: env.ENABLE_AI,
    ENABLE_AUTOMATION: env.ENABLE_AUTOMATION,
    ENABLE_REAL_BROWSER_SYNC: env.ENABLE_REAL_BROWSER_SYNC,
    ENABLE_REAL_SEND: env.ENABLE_REAL_SEND
  };
}
