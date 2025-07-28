import {
  Body,
  Controller,
  Post,
  Put,
  Delete,
  Param,
  HttpCode,
  Get,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { get } from 'http';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  
  @Get()
  @ApiProperty({ description: 'Get all organizations from hubspot' })
  async getfromHubspot(){
    return await this.organizationService.getAllFromHubspot();
  }
  //========== // =========

  
  @Post('create')
  @HttpCode(201)
  @ApiBody({ type: CreateOrganizationDto })
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  async create(@Body() data: CreateOrganizationDto) {
    const org = await this.organizationService.create(data);
    return {
      statusCode: 201,
      message: 'Organization created successfully',
      organization: org,
    };
  }

  @Put('edit/:id')
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
      statusCode: 200,
      message: 'Organization updated successfully',
      organization: org,
    };
  }

  @Delete('delete/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({
    status: 200,
    description: 'Organization deleted successfully',
  })
  async delete(@Param('id') id: string) {
    await this.organizationService.delete(id);
    return {
      statusCode: 200,
      message: 'Organization deleted successfully',
    };
  }
}
