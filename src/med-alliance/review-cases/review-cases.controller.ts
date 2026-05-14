import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewCasesService } from './review-cases.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES } from '../constants';
import { ListReviewCasesDto } from './dto/list-review-cases.dto';
import { ResolveReviewCaseDto } from './dto/resolve-review-case.dto';

@ApiTags('med-alliance')
@ApiBearerAuth()
@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewCasesController {
  constructor(private readonly reviewCasesService: ReviewCasesService) {}

  // GET /med-alliance/admin/review-cases — Paginated list of review cases.
  @Get('admin/review-cases')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Get a paginated list of review cases that require admin attention',
  })
  @ApiQuery({ type: ListReviewCasesDto })
  @ApiResponse({
    status: 200,
    description: 'Review cases retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied: insufficient permissions',
  })
  async findAll(@Query() query: ListReviewCasesDto) {
    const result = await this.reviewCasesService.findAll(query);
    return {
      status: 200,
      message: 'Review cases retrieved successfully',
      ...result,
    };
  }

  // GET /med-alliance/admin/review-cases/:id — Single review case detail.
  @Get('admin/review-cases/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Get full details for a single review case including context data for resolution',
  })
  @ApiParam({ name: 'id', description: 'Review case UUID' })
  @ApiResponse({
    status: 200,
    description: 'Review case retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Review case not found' })
  @ApiResponse({
    status: 403,
    description: 'Access denied: insufficient permissions',
  })
  async findOne(@Param('id') id: string) {
    const item = await this.reviewCasesService.findOne(id);
    return {
      status: 200,
      message: 'Review case retrieved successfully',
      data: item,
    };
  }

  // PATCH /med-alliance/admin/review-cases/:id/resolve — Resolve a review case.
  @Patch('admin/review-cases/:id/resolve')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Resolve a review case with a resolution note and optional corrective action',
  })
  @ApiParam({ name: 'id', description: 'Review case UUID' })
  @ApiBody({ type: ResolveReviewCaseDto })
  @ApiResponse({
    status: 200,
    description: 'Review case resolved successfully',
  })
  @ApiResponse({ status: 404, description: 'Review case not found' })
  @ApiResponse({
    status: 403,
    description: 'Access denied: insufficient permissions',
  })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReviewCaseDto,
    @CurrentUser() user: USER,
  ) {
    const item = await this.reviewCasesService.resolve(id, user.id, dto);
    return {
      status: 200,
      message: 'Review case resolved successfully',
      data: item,
    };
  }
}
