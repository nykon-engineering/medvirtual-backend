/* istanbul ignore file */
import { Body, Controller, Inject, Get, Param, ParseIntPipe, UseGuards, Patch, Delete, NotFoundException } from '@nestjs/common';

import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/createUser.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { stat } from 'fs';

@ApiTags('User')
@Controller('user')
export class UserController {
    @Inject()
    private readonly userService: UserService;

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get user using ID' })
    @ApiResponse({ status: 200, description: 'User found successfully.' })
    @Get(':id')
    async getUserById(@Param('id') id: string) {
        return this.userService.findById(id);
    }

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get all users of the specific organization' })
    @ApiResponse({ status: 200, description: 'Users found successfully.' })
    @ApiResponse({ status: 404, description: 'No users found in this organization.' })
    @Get(':organizationId')
    async getUsersByOrganizationId(@Param('organizationId') organizationId: string) {
        return this.userService.findByOrganizationId(organizationId);
    }

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Update user' })
    @ApiResponse({ status: 200, description: 'User updated successfully.' })
    @ApiResponse({ status: 400, description: 'Failed to update user' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @Patch(':id')
    //refactor to use CurrentUser decorator
    async updateUser(@Param('id') id: string, @Body() userData: CreateUserDto) {
        return this.userService.update(id, userData);
    }

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Delete user' })
    @ApiResponse({ status: 200, description: 'User deleted successfully.' })
    @ApiResponse({ status: 400, description: 'Failed to delete user' })
    @Delete(':id')
    async deleteUser(@Param('id') id: string) {
        return this.userService.delete(id);
    }
}
