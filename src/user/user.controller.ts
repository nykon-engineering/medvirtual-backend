/* istanbul ignore file */
import {
  Body,
  Controller,
  Get,
  Param,
  UseGuards,
  Patch,
  Delete,
  Query,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/createUser.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { GetProfileDto } from './dto/getProfile.dto';
import { SearchUsersDto } from './dto/searchUsers.dto';
import { GetOrganizationUsersDto } from './dto/getOrganizationUsers.dto';
import { InviteUserToOrganizationDto } from './dto/inviteUserToOrganization.dto';
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

  @Get('search')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Search users for organization owner assignment' })
  @ApiResponse({ status: 200, description: 'Users found successfully.' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for name, email, or job title',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by user role',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by user status',
  })
  @ApiQuery({
    name: 'organization_id',
    required: false,
    type: String,
    description: 'Filter by organization ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of results to return (max 50)',
  })
  async searchUsers(@Query() query: SearchUsersDto) {
    return this.userService.searchUsers(query);
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
  
  @Get('organization/:organizationId/paginated')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin')
  @ApiOperation({ summary: 'Get paginated users of a specific organization' })
  @ApiResponse({ status: 200, description: 'Users found successfully.' })
  @ApiResponse({ status: 404, description: 'Organization not found.' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by role',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort by field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    type: String,
    description: 'Sort order',
  })
  async getOrganizationUsersPaginated(
    @Param('organizationId') organizationId: string,
    @Query() query: GetOrganizationUsersDto,
    @CurrentUser() user: USER,
  ) {
    // Check if user has access to this organization
    if (
      user.role === 'organization_super_admin' &&
      user.organization_id !== organizationId
    ) {
      throw new UnauthorizedException('Access denied to this organization');
    }

    return this.userService.getOrganizationUsersPaginated(
      organizationId,
      query,
    );
  }

  @Post('organization/:organizationId/invite')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin')
  @ApiOperation({ summary: 'Invite a new user to an organization' })
  @ApiResponse({ status: 201, description: 'User invited successfully.' })
  @ApiResponse({
    status: 400,
    description: 'User already exists or invalid data.',
  })
  @ApiResponse({ status: 404, description: 'Organization not found.' })
  @ApiResponse({
    status: 403,
    description: 'Access denied to this organization.',
  })
  async inviteUserToOrganization(
    @Param('organizationId') organizationId: string,
    @Body() inviteData: InviteUserToOrganizationDto,
    @CurrentUser() user: USER,
  ) {
    // Check if user has access to this organization
    if (
      user.role === 'organization_super_admin' &&
      user.organization_id !== organizationId
    ) {
      throw new UnauthorizedException('Access denied to this organization');
    }

    return this.userService.inviteUserToOrganization(
      organizationId,
      inviteData,
      user,
    );
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
  @ApiBody({ type: UpdateUserDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin')
  @ApiOperation({ summary: 'Update user (admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to update user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() userData: UpdateUserDto,
    @CurrentUser() currentUser: USER,
  ) {
    // Check if organization admin is trying to update users in their organization
    if (currentUser.role === 'organization_super_admin') {
      const targetUser = await this.userService.findById(id);
      if (
        !targetUser ||
        targetUser.organization_id !== currentUser.organization_id
      ) {
        throw new UnauthorizedException('Access denied to update this user');
      }
    }

    return this.userService.update(id, userData);
  }

  @Patch('profile/:id')
  @ApiBody({ type: UpdateUserDto })
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update user profile (self or admin)' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully.',
  })
  @ApiResponse({ status: 400, description: 'Failed to update user profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateUserProfile(
    @Param('id') id: string,
    @Body() userData: UpdateUserDto,
    @CurrentUser() currentUser: USER,
  ) {
    // Users can only update their own profile, or admins can update any profile
    if (
      currentUser.id !== id &&
      ![
        'system_super_admin',
        'system_admin',
        'organization_super_admin',
      ].includes(currentUser.role)
    ) {
      throw new UnauthorizedException('You can only update your own profile');
    }

    // Organization admins can only update users in their organization
    if (
      currentUser.role === 'organization_super_admin' &&
      currentUser.id !== id
    ) {
      const targetUser = await this.userService.findById(id);
      if (
        !targetUser ||
        targetUser.organization_id !== currentUser.organization_id
      ) {
        throw new UnauthorizedException('Access denied to update this user');
      }
    }

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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @ApiOperation({ summary: 'Update user status from prospect to client' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to update user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateStatus(@Param('id') id: string) {
    return this.userService.updateStatus(id);
  }
}
