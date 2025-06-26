import { Body, Controller, Inject, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { Prisma } from '@prisma/client';

@Controller('user')
export class UserController {
    @Inject()
    private readonly userService: UserService;

    @Post()
    async createUser(@Body() userData: Prisma.UserCreateInput) {
        return this.userService.create(userData);
    }
}
