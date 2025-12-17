import { Controller, Get, Post, Body, Patch, Param, UseGuards, HttpCode, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { USER } from '@prisma/client';

import { HireRequestService } from './hire-request.service';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';
import { changeStatusHireRequesDTO } from './dto/changeStatus-hire-request.dto';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { reassignDTO } from './dto/reassign-hire-request.dto';
import { ConfirmPanelHireRequestDto } from './dto/confirm-panel-hire-request.dto';
import { panelReadyDTO } from './dto/panelReady-hire-request.dto';
import { scheduleInterviewDTO } from './dto/schedule-interview.dto';
import { awaitingDecisionDTO } from './dto/awaiting-decision.dto';
import { changeWinnerDTO } from './dto/change-winner.dto';
import { editInterviewDTO } from './dto/edit-interview.dt';

@Controller('hire-request')
export class HireRequestController {
  constructor(private readonly hireRequestService: HireRequestService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Create new hire request' })
  @ApiBody({ type: CreateHireRequestDto })
  @ApiResponse({ status: 200, description: 'Hire request created successfully' })
  async create(@Body() createHireRequestDto: CreateHireRequestDto, @CurrentUser() user: USER): Promise<object> {
    const result = await this.hireRequestService.create(createHireRequestDto, user);
    return {
      status: 201,
      message: 'Hire request created successfully',
      data: result,
    }
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get all hire requests regarding rules for the current user' })
  @ApiQuery({ name: 'search', required: false, description: 'Search hire requests by title' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Number of items per page' })
  @ApiQuery({ name: 'businessUnit', required: false, description: 'Filter by business unit' })
  @ApiResponse({ status: 200, description: 'List of hire requests with pagination info' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'User role not found' })
  async findAll(
    @CurrentUser() user: USER, 
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('businessUnit') businessUnit?: string,
    @Query('status') status?: string
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const perPageNumber = perPage ? parseInt(perPage, 10) : 10;
    const result = await this.hireRequestService.findAll(user, search, pageNumber, perPageNumber, businessUnit, status);
    return {
      status: 200,
      message: 'Data retrieved successfully',
      ...result,
    }
  }


  @Get('available-candidates-panel')
  @UseGuards(AuthGuard)
  @ApiOperation({ 
    description: 'Get available candidates for hire request candidate selection change. Returns candidates assigned to the hire request panel who are still available for hiring (not hired or in other hire requests). If only the current selected candidate is available, returns empty array to indicate no change is possible.' 
  })
  @ApiQuery({ name: 'hireRequestId', required: true, description: 'ID of the hire request' })
  @ApiResponse({ status: 200, description: 'Available candidates retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  async getAvailableCandidatesForSelection(@Query('hireRequestId') hireRequestId: string, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.getAvailableCandidatesForSelection(hireRequestId, user);
    return {
      status: 200,
      message: 'Available candidates retrieved successfully',
      data: result,
    }
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get specific requests regarding rules for the current user' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiResponse({ status: 200, description: 'Hire request found successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.findOne(id, user);
    return {
      status: 200,
      message: 'Hire request found successfully',
      data: result,
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Update specific requests regarding rules for the current user' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: UpdateHireRequestDto })
  @ApiResponse({ status: 200, description: 'Hire request updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Hire request not updated' })
  @ApiResponse({ status: 400, description: 'Hire request skills not updated' })
  async update(@Param('id') id: string, @Body() updateHireRequestDto: UpdateHireRequestDto, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.update(id, updateHireRequestDto, user);
    return {
      status: 200,
      message: 'Hire request updated successfully',
      data: result,
    }
  }

  @Patch('change-status/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin', 'organization_admin')
  @ApiOperation({ description: 'Update status of specific hire request' })
  @ApiQuery({ name: 'id', required: true, description: 'Hire request ID' })
  @ApiBody({ type: changeStatusHireRequesDTO })
  @ApiResponse({ status: 200, description: 'Hire request status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Data for status change is required' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 400, description: 'Hire request status not updated' })
  @ApiResponse({ status: 400, description: 'Status change from XXXX to XXXXX is not allowed' })
  async updateStatus(@Param('id') id: string, @Body() data: changeStatusHireRequesDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.updateStatus(id, data, user);
    return {
      status: 200,
      message: 'Hire request status updated successfully',
      data: result,
    }
  }

  @Post('reassign/:id/:type')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Reassign specific hire request/Panel to another user' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiParam({ name: 'type', required: true, description: 'Type of request: concierge or sourcing' })
  @ApiBody({ type: reassignDTO } )
  @ApiResponse({ status: 200, description: 'Hire request reassigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  async reassign(@Param('id') id: string, @CurrentUser() user: USER, @Body() data: reassignDTO, @Param('type') type: string) {
    const result = await this.hireRequestService.reassign(id, user, data, type);
    return {
      status: 200,
      message: 'Hire request reassigned successfully',
      data: result,
    }
  }

  @Get('start-sourcing/show-match-candidates/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Show possibles candidates for a specific hire request' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiResponse({ status: 200, description: 'Candidates returned successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  async showMatchCandidates(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.showMatchCandidates(id, user);
    return {
      status: 200,
      message: 'Candidates returned successfully',
      data: result,
    }
  }

  @Post('start-sourcing/confirm-panel')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Confirm panel for a specific hire request' })
  @ApiBody({ type: ConfirmPanelHireRequestDto })
  @ApiResponse({ status: 200, description: 'Panel confirmed successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Data is required to confirm panel' })
  @ApiResponse({ status: 400, description: 'Exactly 5 candidates must be selected to confirm panel' })
  @ApiResponse({ status: 400, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Panel candidates not added' })
  @ApiResponse({ status: 400, description: 'Panel not confirmed' })
  async confirmPanel(@Body() data: ConfirmPanelHireRequestDto, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.confirmPanel(data, user);
    return {
      status: 200,
      message: 'Panel confirmed successfully',
      data: result,
    }
  }

  @Post('sourcing/edit-panel')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Edit panel for a specific hire request' })
  @ApiBody({ type: ConfirmPanelHireRequestDto })
  @ApiResponse({ status: 200, description: 'Panel updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Data is required to confirm panel' })
  @ApiResponse({ status: 400, description: 'Exactly 5 candidates must be selected to confirm panel' })
  @ApiResponse({ status: 400, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Panel candidates not removed' })
  @ApiResponse({ status: 400, description: 'Panel candidates not added' })
  @ApiResponse({ status: 400, description: 'Panel not confirmed' })
  async editPanel(@Body() data: ConfirmPanelHireRequestDto, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.editPanel(data, user);
    return {
      status: 200,
      message: 'Panel updated successfully',
      data: result,
    }
  }

  @Post('sourcing/panel-ready')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Mark Panel Ready for a specific hire request' })
  @ApiBody({ type: panelReadyDTO })
  @ApiResponse({ status: 200, description: 'Panel marked ready successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Data is required to confirm panel' })
  @ApiResponse({ status: 400, description: 'Hire request not updated to panel ready' })
  @ApiResponse({ status: 400, description: 'Panel not updated to readable' })
  async panelReady(@Body() data: panelReadyDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.panelReady(data, user);
    return {
      status: 200,
      message: 'Panel marked ready successfully',
      data: result,
    }
  }

  @Get('get-panel/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get specific Panel' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiResponse({ status: 200, description: 'Panel returned successfully' })
  @ApiResponse({ status: 400, description: 'Hire request ID is required' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel candidates not found' })
  async getPanel(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.getPanel(id, user);
    return {
      status: 200,
      message: 'Panel returned successfully',
      data: result,
    }
  }

  @Get('get-panels/all')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get all readable Panels of the specific/current logged organization' })
  @ApiResponse({ status: 200, description: 'Panels returned successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Panels not found for this current organization' })
  async getPanels(@CurrentUser() user: USER) {
    const result = await this.hireRequestService.getPanels(user);
    return {
      status: 200,
      message: 'Panels returned successfully',
      data: result,
    }
  }

  @Get('get-panels-readable/all')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('organization_super_admin', 'organization_admin')
  @ApiOperation({ description: 'Get all readable Panels of the specific/current logged organization' })
  @ApiResponse({ status: 200, description: 'Panels returned successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Panels not found for this current organization' })
  async getPanelsByOrganization(@CurrentUser() user: USER) {
    const result = await this.hireRequestService.getPanelsByOrganization(user);
    return {
      status: 200,
      message: 'Panels returned successfully',
      data: result,
    }
  }

  @Post('schedule-interview/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Schedule interview for a specific hire request' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: scheduleInterviewDTO })
  @ApiResponse({ status: 200, description: 'Interview scheduled successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Interview not scheduled' })
  @ApiResponse({ status: 400, description: 'Candidate panel not updated to interview scheduled' })
  @ApiResponse({ status: 400, description: 'Hire request status not updated to interview scheduled' })
  async scheduleInterview(@Param('id') id: string, @Body() data: scheduleInterviewDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.scheduleInterview(id, data, user);
    return {
      status: 200,
      message: 'Interview scheduled successfully',
      data: result,
    }
  }

  @Post('edit-interview/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'edit interview for a specific hire request' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: editInterviewDTO })
  @ApiResponse({ status: 200, description: 'Interview updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  async editInterview(@Param('id') id: string, @Body() data: editInterviewDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.editInterview(id, data, user);
    return {
      status: 200,
      message: 'Interview scheduled successfully',
      data: result,
    }
  }

  @Post('awaiting-decision/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Mark hire request as awaiting decision' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: awaitingDecisionDTO })
  @ApiResponse({ status: 200, description: 'Hire request marked as awaiting decision successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Panel not updated to decision_pending' })
  @ApiResponse({ status: 400, description: 'Hire request status not updated to awaiting decision' })
  async awaitingDecision(@Param('id') id: string, @Body() data: awaitingDecisionDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.awaitingDecision(id, data, user);
    return {
      status: 200,
      message: 'Hire request marked as awaiting decision successfully',
      data: result,
    }
  }

  @Post('allow-more-time/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Allow more time for the user make their decision' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: awaitingDecisionDTO })
  @ApiResponse({ status: 200, description: 'Deadline updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Panel not updated to allow more time' })
  async allowMoreTime(@Param('id') id: string, @Body() data: awaitingDecisionDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.allowMoreTime(id, data, user);
    return {
      status: 200,
      message: 'Deadline updated successfully',
      data: result,
    }
  }

  @Post('change-winner/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Change winner of a specific hire request' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: changeWinnerDTO })
  @ApiResponse({ status: 200, description: 'Winner changed successfully and the candidate was moved to endorsed stage on the hubspot' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Pipeline status not found for Endorsed via client' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Winner candidate not found in the panel' })
  @ApiResponse({ status: 400, description: 'Panel not updated to decision made' })
  @ApiResponse({ status: 400, description: 'Hire request not updated to placement completed' })
  @ApiResponse({ status: 400, description: 'Panel not updated to reset winners' })
  @ApiResponse({ status: 400, description: 'Panel not updated to set other candidates as not selected' })
  @ApiResponse({ status: 400, description: 'Candidate not updated to endorsed' })
  async changeWinner(@Param('id') id: string, @Body() data: changeWinnerDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.changeWinner(id, data, user);
    return {
      status: 200,
      message: 'Winner changed successfully and the candidate was moved to endorsed stage on the hubspot',
      data: result,
    }
  }

  @Get('by-candidate/:id')
  @HttpCode(200)
  @ApiOperation({ description: 'Get the Matched HireRequest for a specific candidate' })
  @ApiParam({ name: 'id', required: true, type: String, description: 'Candidate ID' })
  @ApiResponse({ status: 200, description: 'Matched HireRequest retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  async showMatchHireRequests(@Param('id') id: string) {
    const result = await this.hireRequestService.showMatchHireRequests(id);
    return {
      status: 200,
      message: 'Matched HireRequest retrieved successfully',
      data: result
    }
  }


  @Get('vatypes/options')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get VA Types options' })

  async getVATypesController() {
    const result = await this.hireRequestService.getVATypes();
    return {
      status: 200,
      message: 'VA Types retrieved successfully',
      data: result,
    }
  };

  @Get('va-shift-hours/options')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get VA Types options' })

  async getVAShiftHoursController() {
    const result = await this.hireRequestService.getVAShiftHours();
    return {
      status: 200,
      message: 'VA Shift hours retrieved successfully',
      data: result,
    }
  };

  @Get('pairing-request-type/options')
  @UseGuards(AuthGuard)
  @ApiOperation({ description: 'Get Pairing request types options' })

  async getPairingRequestTypeController() {
    const result = await this.hireRequestService.getPairingRequestType();
    return {
      status: 200,
      message: 'Pairing request types retrieved successfully',
      data: result,
    }
  };

  

}
