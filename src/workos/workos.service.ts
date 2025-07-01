// src/workos/workos.service.ts
import { Injectable } from '@nestjs/common';
import { WorkOS } from '@workos-inc/node';

@Injectable()
export class WorkosService {
  private workos: WorkOS;

  constructor() {
    this.workos = new WorkOS(process.env.WORKOS_API_KEY, {
      clientId: process.env.WORKOS_CLIENT_ID,
    });
  }

  async getUserByCode(code: string): Promise<any> {
    if (!code) {
      throw new Error('Code is required for authentication');
    }
    try{
      const user = await this.workos.userManagement.authenticateWithCode(
        {
          code,
          clientId: process.env.WORKOS_CLIENT_ID!,
        }
      );
      if (!user) {
        throw new Error('Failed to retrieve user from WorkOS');
      }
      return user;
    } catch (error) {
      throw new Error('Failed to retrieve user profile from WorkOS', error);
    }
  }

  async getUrl(){
    try{
      const authorizationUrl = await this.workos.userManagement.getAuthorizationUrl(
      {
        provider: 'authkit',
        redirectUri: process.env.WORKOS_REDIRECT_URL+'/auth/callback',
        clientId: process.env.WORKOS_CLIENT_ID!,
      });
      return authorizationUrl;
    } catch (error) { 
      throw new Error('Failed to generate authorization URL');
    }
  }


}
