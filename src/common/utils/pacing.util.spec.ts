import { sleep, randomDelay, pace } from './pacing.util';

describe('pacing.util', () => {
  describe('sleep', () => {
    it('should resolve after the specified delay', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95); // allow minor timing variance
    });
  });

  describe('randomDelay', () => {
    it('should resolve after a delay between min and max', async () => {
      const start = Date.now();
      await randomDelay(100, 200);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95);
    });
  });

  describe('pace', () => {
    it('should wait for a jittered period', async () => {
      const start = Date.now();
      await pace(100, 0.1); // min 90ms, max 110ms
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(85);
    });
  });
});
