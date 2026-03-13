import { startWorker } from './index';

describe('worker bootstrap', () => {
  it('starts in idle mode', () => {
    expect(startWorker()).toMatchObject({ status: 'idle' });
  });
});
