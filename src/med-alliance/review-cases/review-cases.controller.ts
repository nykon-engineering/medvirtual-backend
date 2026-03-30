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
import { ReviewCasesService } from './review-cases.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES } from '../constants';
import { ListReviewCasesDto } from './dto/list-review-cases.dto';
import { ResolveReviewCaseDto } from './dto/resolve-review-case.dto';

@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewCasesController {
  constructor(private readonly reviewCasesService: ReviewCasesService) {}

  // GET /med-alliance/admin/review-cases — Paginated list of review cases.
  @Get('admin/review-cases')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findAll(@Query() query: ListReviewCasesDto) {
    const result = await this.reviewCasesService.findAll(query);
    return { status: 200, message: 'Review cases retrieved successfully', ...result };
  }

  // GET /med-alliance/admin/review-cases/:id — Single review case detail.
  @Get('admin/review-cases/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findOne(@Param('id') id: string) {
    const item = await this.reviewCasesService.findOne(id);
    return { status: 200, message: 'Review case retrieved successfully', data: item };
  }

  // PATCH /med-alliance/admin/review-cases/:id/resolve — Resolve a review case.
  @Patch('admin/review-cases/:id/resolve')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReviewCaseDto,
    @CurrentUser() user: USER,
  ) {
    const item = await this.reviewCasesService.resolve(id, user.id, dto);
    return { status: 200, message: 'Review case resolved successfully', data: item };
  }
}
