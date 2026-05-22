import { Controller, Post, Req, Headers, BadRequestException, Get, UseGuards, Body, Param } from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('stripe/customers')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  async listCustomers() {
    return this.stripeService.listCustomers();
  }

  @Post('stripe/customers')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  async createCustomer(@Body() body: { name: string; email?: string }) {
    if (!body.name) {
      throw new BadRequestException('Name is required');
    }
    return this.stripeService.createCustomer(body.name, body.email || '');
  }

  @Get('stripe/invoices/:id/url')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  async getInvoiceUrl(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Stripe invoice ID is required');
    }
    return this.stripeService.getInvoiceUrl(id);
  }

  @Post('webhooks/stripe')
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available. Ensure rawBody is enabled in main.ts');
    }
    return this.stripeService.handleWebhook(rawBody, signature);
  }
}
