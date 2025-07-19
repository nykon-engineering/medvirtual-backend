/* istanbul ignore file */
import { Body, Controller, Inject, Get, Param, UseGuards, Patch, Delete } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/createUser.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';


@ApiTags('User')
@Controller('user')
export class UserController {
    
    constructor(private readonly userService: UserService){}
    
    @Get(':id')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get user using ID' })
    @ApiResponse({ status: 200, description: 'User found successfully.' })
    async getUserById(@Param('id') id: string) {
        return this.userService.findById(id);
    }

    @Get('organization/:organizationId')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get all users of the specific organization' })
    @ApiResponse({ status: 200, description: 'Users found successfully.' })
    @ApiResponse({ status: 404, description: 'No users found in this organization.' })
    async getUsersByOrganizationId(@Param('organizationId') organizationId: string) {
        return this.userService.findByOrganizationId(organizationId);
    }

    @Patch(':id')
    @ApiBody({ type: CreateUserDto })
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Update user' })
    @ApiResponse({ status: 200, description: 'User updated successfully.' })
    @ApiResponse({ status: 400, description: 'Failed to update user' })
    @ApiResponse({ status: 404, description: 'User not found' })
    //refactor to use CurrentUser decorator
    async updateUser(@Param('id') id: string, @Body() userData: CreateUserDto) {
        return this.userService.update(id, userData);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Delete user' })
    @ApiResponse({ status: 200, description: 'User deleted successfully.' })
    @ApiResponse({ status: 400, description: 'Failed to delete user' })
    async deleteUser(@Param('id') id: string) {
        return this.userService.delete(id);
    }

    @Patch('update-status/:id')
    @ApiBody({ type: CreateUserDto })
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Update user status from prospect to client' })
    @ApiResponse({ status: 200, description: 'User updated successfully.' })
    @ApiResponse({ status: 400, description: 'Failed to update user' })
    @ApiResponse({ status: 404, description: 'User not found' })
    //refactor to use CurrentUser decorator
    async updateStatus(@Param('id') id: string) {
        return this.userService.updateStatus(id);
    }
}
