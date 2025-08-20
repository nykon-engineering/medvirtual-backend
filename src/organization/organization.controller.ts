import {
  Body,
  Controller,
  Post,
  Put,
  Delete,
  Param,
  HttpCode,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  
  @Get('hubspot')
  @ApiProperty({ description: 'Get all organizations from hubspot' })
  async getfromHubspot(){
    return await this.organizationService.getAllFromHubspot();
  }
  //========== // =========

  @Get('')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({status: 200, description: 'List of organizations retrieved successfully'})
  async getAll(@CurrentUser() user: USER) {
    return await this.organizationService.getAll(user);
  }

  @Get('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin','system_super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get organization by Id' })
  @ApiResponse({
    status: 200,
    description: 'Organization retrieved successfully',
  })
  async getById(@Param('id') id: string) {
    return await this.organizationService.getById(id);
  }

  
  @Post('create')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @HttpCode(201)
  @ApiBody({ type: CreateOrganizationDto })
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  async create(@Body() data: CreateOrganizationDto, @CurrentUser() user: any) {
    const org = await this.organizationService.create(data, user);
    return {
      status: 201,
      message: 'Organization created successfully',
      organization: org,
    };
  }

  @Put('edit/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin','system_super_admin')
  @HttpCode(200)
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiOperation({ summary: 'Edit organization info' })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
  })
  async update(@Param('id') id: string, @Body() data: UpdateOrganizationDto) {
    const org = await this.organizationService.update(id, data);
    return {
      status: 200,
      message: 'Organization updated successfully',
      organization: org,
    };
  }

  @Delete('delete/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({
    status: 200,
    description: 'Organization deleted successfully',
  })
  async delete(@Param('id') id: string) {
    await this.organizationService.delete(id);
    return {
      status: 200,
      message: 'Organization deleted successfully',
    };
  }
}
