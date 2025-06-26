import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

import { UserService } from '../user/user.service';
import { WorkosService } from '../workos/workos.service';

@Injectable()
export class AuthService {
    @Inject()
    private readonly userService: UserService;
    private readonly workosService: WorkosService

    async handleUser(code: string): Promise<string> {
        const profile = await this.workosService.getProfile(code);
        if (!profile) {
            throw new Error('Failed to retrieve user profile from WorkOS');
        }
        let user = await this.userService.findByEmail(profile.email);
        if (!user) {
          user = await this.userService.create({
            email: profile.email,
            name: `${profile.firstName} ${profile.lastName}`,
            role: profile.role?.slug || 'user',
            workosId: profile.id,
            organizationId: profile.organizationId || 'default',
          });
        }
    
        const token = jwt.sign({id: user.id}, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });
        
        return token;
    }


}
