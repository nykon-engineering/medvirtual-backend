import { BillComPendingCredentialsStore } from './bill-com-pending-credentials.store';

describe('BillComPendingCredentialsStore', () => {
  let store: BillComPendingCredentialsStore;

  beforeEach(() => {
    store = new BillComPendingCredentialsStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the stored credentials on take()', () => {
    store.set('user-1', 'admin@medvirtual.ai', 'secret123');

    expect(store.take('user-1')).toEqual({
      username: 'admin@medvirtual.ai',
      password: 'secret123',
    });
  });

  it('is one-time use — a second take() returns null', () => {
    store.set('user-1', 'admin@medvirtual.ai', 'secret123');

    store.take('user-1');
    expect(store.take('user-1')).toBeNull();
  });

  it('returns null when nothing was stored for that user', () => {
    expect(store.take('unknown-user')).toBeNull();
  });

  it('returns null once the TTL has expired', () => {
    jest.useFakeTimers();
    store.set('user-1', 'admin@medvirtual.ai', 'secret123');

    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(store.take('user-1')).toBeNull();
  });
});
