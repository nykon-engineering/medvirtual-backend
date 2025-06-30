import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

import { UserService } from '../user/user.service';
import { WorkosService } from '../workos/workos.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly workosService: WorkosService,
  ) {}

    async handleUser(code: string): Promise<string> {
        console.log('Received code 2:', code);
        
        const user = await this.workosService.getUserByCode(code);
        console.log('User profile:', user);

        if (!user) {
            throw new Error('Failed to retrieve user profile from WorkOS');
        }
        
        let userDB = await this.userService.findByEmail(user.email);

        if (!userDB) {
          userDB = await this.userService.create({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role?.slug || 'user',
            workosId: user.id,
            organizationId: user.organizationId || 'default',
          });
        }
        console.log('User created or found:', userDB);
        const token = jwt.sign({id: userDB.id}, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });
        
        return token;
  }

  async signIn(): Promise<string> {
    const authorizationUrl = await this.workosService.getUrl();
    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL');
    }
    return authorizationUrl;
  }


}
