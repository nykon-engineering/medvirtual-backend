import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TalentPoolLeadsService } from './talent-pool-leads.service';
import { CreateTalentPoolLeadDto } from './dto/create-talent-pool-lead.dto';
import { UpdateTalentPoolLeadDto } from './dto/update-talent-pool-lead.dto';
import { QueryTalentPoolLeadsDto } from './dto/query-talent-pool-leads.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Talent Pool Leads')
@Controller()
export class TalentPoolLeadsController {
  constructor(
    private readonly talentPoolLeadsService: TalentPoolLeadsService,
  ) {}

  @Post('public/talent-pool-leads')
  @Throttle({ default: { limit: 3, ttl: 86400000 } }) // 3 requests per day per IP
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new talent pool lead (public endpoint)',
    description:
      'Public endpoint to submit a talent pool inquiry. Rate limited to 3 submissions per email per day.',
  })
  @ApiBody({ type: CreateTalentPoolLeadDto })
  @ApiResponse({
    status: 201,
    description: 'Lead saved successfully',
    schema: {
      example: {
        status: 201,
        message: 'Lead saved successfully',
        data: {
          id: 'uuid-here',
          name: 'John Doe',
          email: 'john@healthcare.com',
          organization: 'Healthcare Organization Name',
          status: 'new',
          created_at: '2024-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or rate limit exceeded',
    schema: {
      example: {
        status: 400,
        message: 'Validation error',
        errors: {
          email: 'Email is required',
          name: 'Name is required',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Lead with this email already exists for this source',
    schema: {
      example: {
        status: 409,
        message: 'Lead with this email already exists for this source',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests. Rate limit exceeded.',
  })
  async createPublicLead(@Body() createDto: CreateTalentPoolLeadDto) {
    const lead = await this.talentPoolLeadsService.create(createDto);
    return {
      status: 201,
      message: 'Lead saved successfully',
      data: lead,
    };
  }

  @Get('talent-pool-leads')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all talent pool leads (admin/marketing)',
    description:
      'Get all talent pool leads with pagination, filtering, and search. Requires admin or marketing role.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['new', 'contacted', 'qualified', 'converted', 'rejected'],
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['talent-pool-page', 'berry-talent-pool-page'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'John' })
  @ApiResponse({
    status: 200,
    description: 'Leads retrieved successfully',
    schema: {
      example: {
        status: 200,
        data: [
          {
            id: 'uuid',
            name: 'John Doe',
            email: 'john@healthcare.com',
            organization: 'Healthcare Org',
            main_need: '3 bilingual VAs',
            additional_details: 'Details...',
            source: 'talent-pool-page',
            status: 'new',
            created_at: '2024-01-15T10:30:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 150,
          totalPages: 8,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getAllLeads(@Query() query: QueryTalentPoolLeadsDto) {
    const result = await this.talentPoolLeadsService.findAll(query);
    return {
      status: 200,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Patch('talent-pool-leads/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a talent pool lead (admin/marketing)',
    description:
      'Update the status, notes, or assigned user of a talent pool lead. Requires admin or marketing role.',
  })
  @ApiParam({ name: 'id', description: 'Lead ID', type: String })
  @ApiBody({ type: UpdateTalentPoolLeadDto })
  @ApiResponse({
    status: 200,
    description: 'Lead updated successfully',
    schema: {
      example: {
        status: 200,
        message: 'Lead updated successfully',
        data: {
          id: 'uuid',
          status: 'contacted',
          notes: 'Called on 2024-01-16, interested in 5 VAs',
          updated_at: '2024-01-16T14:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input or user not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
  })
  async updateLead(
    @Param('id') id: string,
    @Body() updateDto: UpdateTalentPoolLeadDto,
  ) {
    if (!id) {
      throw new BadRequestException('Lead ID is required');
    }

    const updatedLead = await this.talentPoolLeadsService.update(id, updateDto);
    return {
      status: 200,
      message: 'Lead updated successfully',
      data: updatedLead,
    };
  }
}
