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

  async getProfile(code: string) {
    const response = await this.workos.sso.getProfileAndToken({
      code,
      clientId: process.env.WORKOS_CLIENT_ID || '',
    });

    return response.profile;
  }

  async getUrl(){
    console.log('Arrived in getAuthorization method');
    try{
      const authorizationUrl = await this.workos.userManagement.getAuthorizationUrl(
      {
        provider: 'authkit',
        redirectUri: process.env.WORKOS_REDIRECT_URL+'/auth/callback',
        clientId: process.env.WORKOS_CLIENT_ID || '',
      });
      console.log('Authorization URL:', authorizationUrl);
      return authorizationUrl;
    } catch (error) { 
      console.error('Error generating authorization URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }


}
