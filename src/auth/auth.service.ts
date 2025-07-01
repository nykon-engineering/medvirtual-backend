import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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
        const result = await this.workosService.getUserByCode(code);
        if (!result) {
            throw new Error('Failed to retrieve user profile from WorkOS');
        }

        const user = result.user;
        console.log('User:', user);
        console.log('Email:', user.email);
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

  async workOsSignIn(): Promise<string> {
    const authorizationUrl = await this.workosService.getUrl();
    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL');
    }
    return authorizationUrl;
  }

  async signin(data: any): Promise<string> {
    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const token = jwt.compareSync(data.password, user.password);

  }


}
