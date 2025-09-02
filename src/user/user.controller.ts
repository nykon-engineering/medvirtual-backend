/* istanbul ignore file */
import {
  Body,
  Controller,
  Get,
  Param,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/createUser.dto';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { GetProfileDto } from './dto/getProfile.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { USER } from '@prisma/client';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get current user profile with organization details',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully.',
    type: GetProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getCurrentUserProfile(@CurrentUser() user: USER) {
    return this.userService.getCurrentUserProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  @ApiBody({ type: UpdateProfileDto })
  @ApiOperation({
    summary: 'Update current user profile (email cannot be modified)',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
    type: GetProfileDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid profile data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateCurrentUserProfile(
    @CurrentUser() user: USER,
    @Body() profileData: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, profileData);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @ApiOperation({ summary: 'Get user using ID' })
  @ApiResponse({ status: 200, description: 'User found successfully.' })
  async getUserById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Get('organization/:organizationId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @ApiOperation({ summary: 'Get all users of the specific organization' })
  @ApiResponse({ status: 200, description: 'Users found successfully.' })
  @ApiResponse({
    status: 404,
    description: 'No users found in this organization.',
  })
  async getUsersByOrganizationId(
    @Param('organizationId') organizationId: string,
  ) {
    return this.userService.findByOrganizationId(organizationId);
  }

  @Get('organization/users/by-current-user')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @ApiOperation({ summary: 'Get all users of the organization from current User' })
  @ApiResponse({ status: 200, description: 'Users found successfully.' })
  @ApiResponse({
    status: 404,
    description: 'No users found in this organization.',
  })
  async findUsersByOrganizationByCurrentUser(@CurrentUser() user: USER) {
    return this.userService.findUsersByOrganizationByCurrentUser(user);
  }





  

  @Patch(':id')
  @ApiBody({ type: CreateUserDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to update user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  //refactor to use CurrentUser decorator
  async updateUser(@Param('id') id: string, @Body() userData: CreateUserDto) {
    return this.userService.update(id, userData);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete user' })
  @Roles('system_super_admin')
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to delete user' })
  async deleteUser(@Param('id') id: string) {
    return this.userService.delete(id);
  }

  @Patch('update-status/:id')
  @ApiBody({ type: CreateUserDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @ApiOperation({ summary: 'Update user status from prospect to client' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to update user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  //refactor to use CurrentUser decorator
  async updateStatus(@Param('id') id: string) {
    return this.userService.updateStatus(id);
  }
}
