import { Controller, Get, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OfferPanelsService } from './offer-panels.service';

@ApiTags('Offer Panels — Public')
@Controller()
export class PublicOfferPanelsController {
  constructor(private readonly offerPanelsService: OfferPanelsService) {}

  @Get('public/offer-panels/:token')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public offer panel by token (no auth, R13)' })
  @ApiParam({ name: 'token', type: String, description: 'Unguessable public token' })
  @ApiResponse({
    status: 200,
    description:
      'Returns the offer panel with candidates regardless of status. Frontend renders per status.',
  })
  @ApiResponse({ status: 404, description: 'Token not found or panel deleted' })
  async findByToken(@Param('token') token: string) {
    const data = await this.offerPanelsService.findByToken(token);
    return { status: 200, data };
  }

  // Task 4.1 — track view (public, R17)
  @Post('public/offer-panels/:token/viewed')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track that the public recipient viewed the offer panel (R17)' })
  @ApiParam({ name: 'token', type: String, description: 'Unguessable public token' })
  @ApiResponse({ status: 200, description: 'View tracked' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async trackView(@Param('token') token: string) {
    await this.offerPanelsService.trackViewByToken(token);
    return { status: 200 };
  }

  // Task 4.3 — decline (public, R6/R12)
  @Post('public/offer-panels/:token/decline')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a public offer panel (R6). Notifies admin (R12). Idempotent.' })
  @ApiParam({ name: 'token', type: String, description: 'Unguessable public token' })
  @ApiResponse({ status: 200, description: 'Declined successfully' })
  @ApiResponse({ status: 400, description: 'Cannot decline an accepted panel' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async decline(@Param('token') token: string) {
    await this.offerPanelsService.declineByToken(token);
    return { status: 200 };
  }

  // Task 4.5 — accept (public, R5/R12)
  @Post('public/offer-panels/:token/accept')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a public offer panel → creates interview Ticket (R5). Notifies admin (R12). Idempotent.',
  })
  @ApiParam({ name: 'token', type: String, description: 'Unguessable public token' })
  @ApiResponse({ status: 200, description: 'Accepted. Returns the created Ticket.' })
  @ApiResponse({ status: 400, description: 'Cannot accept a declined panel' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async accept(@Param('token') token: string) {
    const data = await this.offerPanelsService.acceptByToken(token);
    return { status: 200, data };
  }
}
