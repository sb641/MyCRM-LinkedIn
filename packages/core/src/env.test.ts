import { parseEnv } from './env';

describe('env validation', () => {
  it('parses valid env values', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      ENABLE_AI: 'true',
      ENABLE_AUTOMATION: 'false',
      ENABLE_REAL_BROWSER_SYNC: 'false',
      ENABLE_REAL_SEND: 'false',
      LOG_LEVEL: 'debug'
    });

    expect(env.ENABLE_AI).toBe(true);
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'test',
        ENABLE_AI: 'false',
        ENABLE_AUTOMATION: 'false',
        ENABLE_REAL_BROWSER_SYNC: 'false',
        ENABLE_REAL_SEND: 'false',
        LOG_LEVEL: 'info'
      }),
    ).toThrow(/DATABASE_URL/i);
  });
});
