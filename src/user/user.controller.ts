import { Body, Controller, Inject, Get, Query, Res, ParseIntPipe, UseGuards, Patch, Delete, NotFoundException } from '@nestjs/common';

import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/createUser.dto';

@Controller('user')
export class UserController {
    @Inject()
    private readonly userService: UserService;

    @UseGuards(AuthGuard)
    @Get(':id')
    async getUserById(@Query('id', ParseIntPipe) id: number) {
        return this.userService.findById(id);
    }

    @UseGuards(AuthGuard)
    @Get(':organizationId')
    async getUsersByOrganizationId(@Query('organizationId') organizationId: string) {
        return this.userService.findByOrganizationId(organizationId);
    }

    @UseGuards(AuthGuard)
    @Patch(':id')
    async updateUser(@Query('id', ParseIntPipe) id: number, @Body() userData: CreateUserDto) {
        return this.userService.update(id, userData);
    }

    @UseGuards(AuthGuard)
    @Delete(':id')
    async deleteUser(@Query('id', ParseIntPipe) id: number) {
        return this.userService.delete(id);
    }
}
