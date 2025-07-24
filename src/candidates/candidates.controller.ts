import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CandidatesService } from './candidates.service';

import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ApiBody, ApiParam, ApiProperty } from '@nestjs/swagger';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @ApiProperty({ description: 'Get all candidates for the current user\'s organization' })
  @UseGuards(AuthGuard)
  async findAll(@CurrentUser() user: USER) {
    const result = await this.candidatesService.findAll(user);
    return {
      status: 200,
      message: 'Candidates retrieved successfully',
      data: result
    }
  }

  @Get(':id')
  @ApiProperty({ description: 'Get a specific candidate by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Candidate ID' })
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.candidatesService.findOne(+id, user);
    return {
      status: 200,
      message: 'Candidate retrieved successfully',
      data: result
    }
  }

  @Patch(':id')
  @ApiProperty({ description: 'Update a specific candidate by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Candidate ID' })
  @ApiBody({ type: UpdateCandidateDto, description: 'Candidate update data' })
  @UseGuards(AuthGuard)
  async update(@Param('id') id: string, @CurrentUser() user: USER, @Body() updateCandidateDto: UpdateCandidateDto) {
    const result = this.candidatesService.update(+id, user, updateCandidateDto);
    return {
      status: 200,
      message: 'Candidate update successfully',
      data: result
    }
  }

  @Delete(':id')
  @ApiProperty({ description: 'Delete a specific candidate by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Candidate ID' })
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = this.candidatesService.remove(+id, user);
    return {
      status: 200,
      message: 'Candidate delete successfully',
      data: result
    }
  }
}
