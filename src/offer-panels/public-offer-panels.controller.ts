import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
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
}
