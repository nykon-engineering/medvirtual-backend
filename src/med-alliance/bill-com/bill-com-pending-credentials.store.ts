import { Injectable } from '@nestjs/common';

interface PendingCredentials {
  username: string;
  password: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;

/**
 * Bill.com requires username/password on every /login call, including the
 * re-login after MFA validation (to redeem the fresh rememberMeId into an
 * actual trusted:true session). The frontend only sends credentials once,
 * on the initial login step, so they're held here in memory just long
 * enough to complete that re-login — never persisted to the database.
 */
@Injectable()
export class BillComPendingCredentialsStore {
  private readonly store = new Map<string, PendingCredentials>();

  set(userId: string, username: string, password: string): void {
    this.store.set(userId, { username, password, expiresAt: Date.now() + TTL_MS });
  }

  take(userId: string): { username: string; password: string } | null {
    const entry = this.store.get(userId);
    this.store.delete(userId);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return { username: entry.username, password: entry.password };
  }
}
