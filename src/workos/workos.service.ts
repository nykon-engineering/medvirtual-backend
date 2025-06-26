// src/workos/workos.service.ts
import { Injectable } from '@nestjs/common';
import { WorkOS } from '@workos-inc/node';

@Injectable()
export class WorkosService {
  private workos: WorkOS;

  constructor() {
    this.workos = new WorkOS(process.env.WORKOS_API_KEY);
  }

  async getProfile(code: string) {
    const response = await this.workos.sso.getProfileAndToken({
      code,
      clientId: process.env.WORKOS_CLIENT_ID || '',
    });

    return response.profile;
  }
}
