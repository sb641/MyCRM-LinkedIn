import pino from 'pino';

describe('logger', () => {
  it('emits structured logs', () => {
    const chunks: string[] = [];
    const destination = {
      write: (message: string) => {
        chunks.push(message);
      }
    };
    const logger = pino(
      {
        name: 'test',
        level: 'info',
        base: undefined,
        timestamp: false
      },
      destination,
    );

    logger.info({ event: 'phase0' }, 'boot');

    const output = chunks.join('');
    expect(output).toContain('"event":"phase0"');
    expect(output).toContain('"msg":"boot"');
  });
});
