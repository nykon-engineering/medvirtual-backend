import { Inject, Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsService } from '../secrets/secrets.service';
import Stripe = require('stripe');
import { PrismaService } from '../prisma/prisma.service';
import { Stripe as StripeCore } from 'stripe/cjs/stripe.core';
import * as redis from 'redis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: StripeCore;
  private secretKey: string;
  private publicKey: string;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly secretsService: SecretsService,
    @Inject('REDIS_CLIENT') private readonly redisClient: redis.RedisClientType,
    private readonly prisma: PrismaService,
    @InjectQueue('invoice') private readonly invoiceQueue: Queue,
  ) { }

  async onModuleInit() {
    await this.initializeStripe();
    try {
      await this.initiateWebhookHandler();
    } catch (err) {
      this.logger.error(`Failed to initiate webhook handler on startup: ${err.message}`);
    }
  }

  private async initializeStripe(): Promise<void> {
    const redisBaseKey = this.configService.get<string>('REDIS_BASE_KEY', '');
    let secretKey = '';
    let publicKey = '';

    if (redisBaseKey.includes('PROD')) {
      this.logger.log('Fetching Stripe keys from AWS Secrets Manager...');
      const stripeKeys = await this.secretsService.getSecret('prod/stripe/key01');
      if (stripeKeys) {
        secretKey = stripeKeys.stripe_secret_key || stripeKeys.secret_key || '';
        publicKey = stripeKeys.stripe_public_key || stripeKeys.public_key || '';
      }
    } else {
      this.logger.log('Fetching Stripe keys from Environment config...');
      secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
      publicKey = this.configService.get<string>('STRIPE_PUBLIC_KEY') || '';
    }

    this.secretKey = secretKey;
    this.publicKey = publicKey;

    if (!this.secretKey) {
      this.logger.error('Stripe Secret Key is missing or empty. Stripe initialization aborted.');
      return;
    }

    // Initialize Stripe client
    this.stripe = new Stripe(this.secretKey);
    this.logger.log('Stripe client initialized successfully.');
  }

  public getStripeInstance(): StripeCore {
    return this.stripe;
  }

  public getPublicKey(): string {
    return this.publicKey;
  }

  public async initiateWebhookHandler() {
    if (!this.stripe) {
      this.logger.warn('Stripe is not initialized. Skipping webhook setup.');
      return;
    }

    const redisBaseKey = this.configService.get<string>('REDIS_BASE_KEY', '');
    const secretKey = `${redisBaseKey}:stripe_webhook_secret`;
    let server = 'dev';

    if (redisBaseKey.includes('LOCAL')) {
      server = redisBaseKey;
    } else if (redisBaseKey.includes('STAGING')) {
      server = 'staging';
    } else if (redisBaseKey.includes('PROD')) {
      server = 'prod';
    }

    const webhookBaseUrl = this.configService.get<string>('WEBHOOK_URL') || '';
    if (!webhookBaseUrl) {
      this.logger.warn('WEBHOOK_URL is not configured. Skipping webhook setup.');
      return;
    }
    const webhookUrl = `${webhookBaseUrl}/webhooks/stripe`;

    this.logger.log(`initiateWebhookHandler: Target URL=${webhookUrl}, Server=${server}`);

    const REQUIRED_EVENTS: StripeCore.WebhookEndpointCreateParams.EnabledEvent[] = [
      'customer.created',
      'invoice.paid',
      'invoice.overdue',
      'invoice.voided',
      'invoice.finalized',
      'payment_intent.succeeded',
      'invoice.payment_failed',
      'payment_method.attached',
      'checkout.session.completed',
    ];

    try {
      const list = await this.stripe.webhookEndpoints.list({ limit: 100 });
      let existingWebhook: any = null;

      // Clean up endpoints for the same server with different URLs, and check if target already exists
      for (const item of list.data) {
        const itemServer = item.metadata?.server;
        if (itemServer === server) {
          if (item.url === webhookUrl) {
            existingWebhook = item;
          } else {
            // Delete old/different webhook URL for the same environment
            this.logger.log(`Deleting obsolete webhook endpoint for server ${server}: ${item.url}`);
            await this.stripe.webhookEndpoints.del(item.id);
          }
        }
      }

      if (existingWebhook) {
        // Check if status is enabled, events match exactly, and we have the secret in Redis
        const redisSecret = await this.redisClient.get(secretKey);

        const enabledEvents = existingWebhook.enabled_events || [];
        const eventsMatch = enabledEvents.length === REQUIRED_EVENTS.length &&
          enabledEvents.every((e: string) => (REQUIRED_EVENTS as string[]).includes(e));

        if (existingWebhook.status === 'enabled' && eventsMatch && redisSecret) {
          this.logger.log(`Stripe webhook for URL ${webhookUrl} already exists and is correctly configured. Skipping creation.`);
          return existingWebhook;
        }

        // Otherwise, delete the existing one and recreate it to get a new secret and correct config
        this.logger.log(`Existing webhook for ${webhookUrl} is misconfigured or lacks Redis secret. Re-creating...`);
        await this.stripe.webhookEndpoints.del(existingWebhook.id);
      }

      // Create new webhook
      this.logger.log(`Creating new Stripe webhook endpoint for URL: ${webhookUrl}`);
      const newWebhook = await this.stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: REQUIRED_EVENTS,
        metadata: {
          server,
        },
      });

      if (newWebhook && newWebhook.secret) {
        await this.redisClient.set(secretKey, newWebhook.secret);
        this.logger.log(`Stored Stripe webhook signing secret in Redis under key: ${secretKey}`);
      }

      return newWebhook;
    } catch (err) {
      this.logger.error(`Failed to handle Stripe webhook setup: ${err.message}`);
      throw err;
    }
  }

  public async handleWebhook(rawBody: string | Buffer, signature: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not initialized');
    }

    const redisBaseKey = this.configService.get<string>('REDIS_BASE_KEY', '');
    const redisSecretKey = `${redisBaseKey}:stripe_webhook_secret`;

    let webhookSecret = await this.redisClient.get(redisSecretKey);
    if (!webhookSecret) {
      this.logger.warn(`Webhook secret not found in Redis for key "${redisSecretKey}". Checking environment config.`);
      webhookSecret = this.configService.get<string>('STRIPE_SIGNING_SECRET') || '';
    }

    if (!webhookSecret) {
      throw new BadRequestException('Webhook signing secret is not configured.');
    }

    let event: StripeCore.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    await this.webhookHandler(event);
    return { received: true };
  }

  public async webhookHandler(event: StripeCore.Event) {
    this.logger.log(`Received Stripe event of type: ${event.type}`);
    if (event) {
      switch (event.type) {
        case 'customer.created':
          // leave blank for now
          break;
        case 'payment_intent.succeeded':
          // leave blank for now
          break;
        case 'invoice.paid': {
          this.logger.log(`Handling invoice.paid for Stripe ID: ${event.id}`);
          const paidInvoice = event.data.object as any;
          const internalInvoice = await this.prisma.invoice.findUnique({
            where: { stripe_invoice_id: paidInvoice.id },
          });

          if (internalInvoice) {
            await this.prisma.invoice.update({
              where: { id: internalInvoice.id },
              data: {
                status: 'paid',
                stripe_status: 'paid',
                ...(paidInvoice.number ? { stripe_invoice_number: paidInvoice.number } : {}),
              },
            });

            const authorId = (paidInvoice.metadata?.authorId as string) || 'system';
            let actorId: string | null = null;
            if (authorId && authorId !== 'system') {
              const userExists = await this.prisma.uSER.findUnique({
                where: { id: authorId },
              });
              if (userExists) {
                actorId = authorId;
              }
            }

            await this.prisma.invoiceAuditLog.create({
              data: {
                invoice_id: internalInvoice.id,
                actor_id: actorId,
                event: `Invoice ${internalInvoice.reference || internalInvoice.id} has been marked as paid`,
              },
            });

            const providerRef = (typeof paidInvoice.payment_intent === 'string'
              ? paidInvoice.payment_intent
              : paidInvoice.id) || '';

            const amountDecimal = (paidInvoice.amount_paid ?? paidInvoice.total ?? 0) / 100;
            const paidAt = paidInvoice.status_transitions?.paid_at
              ? new Date(paidInvoice.status_transitions.paid_at * 1000)
              : new Date();

            const existingPayment = providerRef
              ? await this.prisma.invoicePayment.findFirst({
                  where: {
                    invoice_id: internalInvoice.id,
                    provider_reference: providerRef,
                  },
                })
              : null;

            if (existingPayment) {
              await this.prisma.invoicePayment.update({
                where: { id: existingPayment.id },
                data: {
                  status: 'paid',
                  amount: amountDecimal,
                  paid_at: paidAt,
                },
              });
            } else {
              await this.prisma.invoicePayment.create({
                data: {
                  invoice_id: internalInvoice.id,
                  provider: 'stripe',
                  provider_reference: providerRef,
                  amount: amountDecimal,
                  status: 'paid',
                  paid_at: paidAt,
                },
              });
            }
          }
          break;
        }
        case 'invoice.overdue':
          // leave blank for now
          break;
        case 'invoice.payment_failed': {
          this.logger.log(`Handling invoice.payment_failed for Stripe ID: ${event.id}`);
          const failedInvoice = event.data.object as any;
          const internalInvoice = await this.prisma.invoice.findUnique({
            where: { stripe_invoice_id: failedInvoice.id },
          });

          if (internalInvoice) {
            await this.prisma.invoice.update({
              where: { id: internalInvoice.id },
              data: {
                stripe_status: 'payment_failed',
              },
            });

            const authorId = (failedInvoice.metadata?.authorId as string) || 'system';
            let actorId: string | null = null;
            if (authorId && authorId !== 'system') {
              const userExists = await this.prisma.uSER.findUnique({
                where: { id: authorId },
              });
              if (userExists) {
                actorId = authorId;
              }
            }

            await this.prisma.invoiceAuditLog.create({
              data: {
                invoice_id: internalInvoice.id,
                actor_id: actorId,
                event: `Failed to pay for Invoice ${internalInvoice.reference || internalInvoice.id}`,
              },
            });

            const providerRef = (typeof failedInvoice.payment_intent === 'string'
              ? failedInvoice.payment_intent
              : failedInvoice.id) || '';

            const amountDecimal = (failedInvoice.amount_due ?? failedInvoice.total ?? 0) / 100;

            const existingPayment = providerRef
              ? await this.prisma.invoicePayment.findFirst({
                  where: {
                    invoice_id: internalInvoice.id,
                    provider_reference: providerRef,
                  },
                })
              : null;

            if (existingPayment) {
              await this.prisma.invoicePayment.update({
                where: { id: existingPayment.id },
                data: {
                  status: 'failed',
                  amount: amountDecimal,
                },
              });
            } else {
              await this.prisma.invoicePayment.create({
                data: {
                  invoice_id: internalInvoice.id,
                  provider: 'stripe',
                  provider_reference: providerRef,
                  amount: amountDecimal,
                  status: 'failed',
                },
              });
            }
          }
          break;
        }
        case 'payment_method.attached':
          // leave blank for now
          break;
        case 'invoice.voided':
          break;
        case 'invoice.finalized': {
          this.logger.log(`Handling invoice.finalized for Stripe ID: ${event.id}`);
          const finalizedInvoice = event.data.object as StripeCore.Invoice;
          const internalInvoice = await this.prisma.invoice.findUnique({
            where: { stripe_invoice_id: finalizedInvoice.id },
          });

          if (internalInvoice) {
            // 1. Update status to published in internal DB
            await this.prisma.invoice.update({
              where: { id: internalInvoice.id },
              data: {
                status: 'published',
                stripe_status: 'finalized',
                ...(finalizedInvoice.number ? { stripe_invoice_number: finalizedInvoice.number } : {}),
              },
            });

            // 2. Create Audit Log
            const authorId = (finalizedInvoice.metadata?.authorId as string) || 'system';
            let actorId: string | null = null;
            if (authorId && authorId !== 'system') {
              const userExists = await this.prisma.uSER.findUnique({
                where: { id: authorId },
              });
              if (userExists) {
                actorId = authorId;
              }
            }

            await this.prisma.invoiceAuditLog.create({
              data: {
                invoice_id: internalInvoice.id,
                actor_id: actorId,
                event: `Invoice ${internalInvoice.reference} has been marked as published`,
              },
            });

            // 3. Collection attempt
            const now = Date.now();
            const dueDateMs = finalizedInvoice.due_date
              ? DateTime.fromSeconds(finalizedInvoice.due_date).setZone('America/Los_Angeles').startOf('day').toMillis()
              : DateTime.fromMillis(now).setZone('America/Los_Angeles').startOf('day').toMillis();

            if (dueDateMs > now) {
              const delayMs = dueDateMs - now;
              const jobId = `attempt-collection-${internalInvoice.id}`;
              const existingJob = await this.invoiceQueue.getJob(jobId);
              if (existingJob) {
                try {
                  await existingJob.remove();
                } catch (err) {
                  this.logger.warn(`Failed to remove existing delayed job ${jobId}: ${err.message}`);
                }
              }
              await this.invoiceQueue.add(
                'attempt-collection',
                {
                  invoiceId: internalInvoice.id,
                  stripeInvoiceId: finalizedInvoice.id,
                },
                {
                  delay: delayMs,
                  jobId,
                  removeOnComplete: true,
                  removeOnFail: false,
                },
              );
              this.logger.log(`Scheduled collection job for invoice ${internalInvoice.id} in ${delayMs}ms`);
            } else {
              this.logger.log(`Due date is today or in the past. Attempting immediate collection for invoice ${internalInvoice.id}`);
              await this.payInvoice(finalizedInvoice.id);
            }
          }
          break;
        }
        case 'checkout.session.completed':
          break;
        default:
          break;
      }
    }
  }

  public async payInvoice(stripeInvoiceId: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not initialized');
    }
    await this.safeStripeCall(() =>
      this.stripe.invoices.pay(stripeInvoiceId)
    );
  }

  public async listCustomers() {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not initialized');
    }
    const response = await this.stripe.customers.list({ limit: 100 });
    return response.data.map(c => ({
      id: c.id,
      name: c.name || (c as any).description || c.email || 'Unnamed Customer',
      email: c.email || '',
    }));
  }

  public async createCustomer(name: string, email: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not initialized');
    }
    try {
      const customer = await this.stripe.customers.create({
        name,
        email: email || undefined,
      });
      return {
        id: customer.id,
        name: customer.name || (customer as any).description || customer.email || 'Unnamed Customer',
        email: customer.email || '',
      };
    } catch (err) {
      throw new BadRequestException(`Failed to create Stripe customer: ${err.message}`);
    }
  }

  private BUCKET_KEY = 'stripe_rate_limit';
  private MAX_REQUESTS_PER_SECOND = 25;

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async acquireToken(): Promise<void> {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    const key = `${this.BUCKET_KEY}:${currentSecond}`;

    // Increment count for this second
    const requests = await this.redisClient.incr(key);

    if (requests === 1) {
      // First request for this second → set expiry so Redis clears it automatically
      await this.redisClient.expire(key, 2); // 2 sec buffer
    }

    if (requests > this.MAX_REQUESTS_PER_SECOND) {
      // Too many requests this second → wait until next second starts
      const msUntilNextSecond = 1000 - (now % 1000);
      await this.delay(msUntilNextSecond);
      return this.acquireToken(); // retry after waiting
    }
    return;
  }

  public async safeStripeCall<T>(fn: () => Promise<T>, retries = 10): Promise<T> {
    await this.acquireToken();
    try {
      return await fn();
    } catch (err: any) {
      if (retries > 0 && (err.statusCode === 429 || err.type === 'StripeRateLimitError' || err.message?.includes('rate limit'))) {
        this.logger.warn(`Stripe rate limit hit, retrying in 500ms... (${retries} retries left)`);
        await this.delay(500);
        return this.safeStripeCall(fn, retries - 1);
      }
      throw err;
    }
  }

  public async createInvoiceDiscount(
    discount: number,
    clientId: string,
    name?: string,
  ) {
    const invoiceConfig = await this.prisma.invoiceConfiguration.findUnique({
      where: { organization_id: clientId },
    });
    if (invoiceConfig?.stripe_customer_id) {
      const coupon = await this.safeStripeCall(() =>
        this.stripe.coupons.create({
          name,
          percent_off: discount,
          duration: 'once',
        }),
      );
      return await this.safeStripeCall(() =>
        this.stripe.promotionCodes.create({
          coupon: coupon.id,
          max_redemptions: 1,
        } as any),
      );
    }
    return null;
  }

  public async createInvoiceDiscountDollar(
    discount: number,
    clientId: string,
    name?: string,
  ) {
    const invoiceConfig = await this.prisma.invoiceConfiguration.findUnique({
      where: { organization_id: clientId },
    });
    if (invoiceConfig?.stripe_customer_id) {
      const coupon = await this.safeStripeCall(() =>
        this.stripe.coupons.create({
          name,
          amount_off: Math.round(discount * 100),
          currency: 'usd',
          duration: 'once',
        }),
      );
      return await this.safeStripeCall(() =>
        this.stripe.promotionCodes.create({
          coupon: coupon.id,
          max_redemptions: 1,
        } as any),
      );
    }
    return null;
  }

  public async createStripeInvoiceOnly(params: {
    clientId: string;
    reference: string;
    dueDate: Date;
    isPrebill: boolean;
    periodStart?: string;
    periodEnd?: string;
  }) {
    const { clientId, reference, dueDate, isPrebill, periodStart, periodEnd } = params;

    const invoiceConfig = await this.prisma.invoiceConfiguration.findUnique({
      where: { organization_id: clientId },
    });

    if (!invoiceConfig || !invoiceConfig.stripe_customer_id) {
      throw new BadRequestException('Stripe customer ID not found for this organization');
    }

    const stripeCustomerId = invoiceConfig.stripe_customer_id;

    // Fetch customer + payment methods
    const [methods, customer] = await Promise.all([
      this.safeStripeCall(() =>
        this.stripe.paymentMethods.list({ customer: stripeCustomerId }),
      ),
      this.safeStripeCall(() =>
        this.stripe.customers.retrieve(stripeCustomerId),
      ),
    ]);

    let default_payment_method: any = null;

    if (!customer.deleted) {
      const updatePayload: any = {};

      if (!customer.email) {
        const org = await this.prisma.organization.findUnique({
          where: { id: clientId },
        });
        updatePayload.email = org?.email || 'test.email@mailinator.com';
      }

      const invoiceSettings = customer.invoice_settings || {};
      if (!invoiceSettings.default_payment_method) {
        if (methods.data.length > 0) {
          updatePayload.invoice_settings = {
            default_payment_method: methods.data[0].id,
          };
          default_payment_method = methods.data[0];
        }
      } else if (methods.data.length > 0) {
        default_payment_method = methods.data.find(
          (e) =>
            e.id ===
            (invoiceSettings.default_payment_method as string),
        );
      }

      if (Object.keys(updatePayload).length > 0) {
        await this.safeStripeCall(() =>
          this.stripe.customers.update(stripeCustomerId, updatePayload),
        );
      }
    }

    // Normalize due date
    let effectiveDueDate = new Date(dueDate);
    const diffNowMinutes = (effectiveDueDate.getTime() - Date.now()) / (1000 * 60);
    if (diffNowMinutes < 0) {
      effectiveDueDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    }

    const invoice = await this.safeStripeCall(() =>
      this.stripe.invoices.create(
        {
          customer: stripeCustomerId,
          collection_method: 'send_invoice',
          auto_advance: false, // critical: do NOT finalize
          due_date: Math.ceil(effectiveDueDate.getTime() / 1000),
          description: 'Invoice for services rendered',
          metadata: {
            reference: reference || '',
            clientId,
            prebilled: isPrebill ? 'true' : 'false',
            periodStart: periodStart || '',
            periodEnd: periodEnd || '',
          },
        },
        {
          idempotencyKey: `creates-invoice-${reference}-${stripeCustomerId}`,
        },
      ),
    );

    // Persist Stripe linkage ONLY
    await this.prisma.invoice.update({
      where: { reference },
      data: {
        stripe_invoice_id: invoice.id,
        stripe_invoice_number: invoice.number,
        stripe_status: 'invoice_created',
      },
    });

    return {
      invoice,
      default_payment_method,
      stripe_customer_id: stripeCustomerId,
    };
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  private async buildDeterministicInvoiceItems(
    invoice: any,
  ): Promise<
    Array<{
      internalItemId: string;
      amountCents: number;
      description: string;
      type: 'LINE_ITEM';
    }>
  > {
    const result: Array<{
      internalItemId: string;
      amountCents: number;
      description: string;
      type: 'LINE_ITEM';
    }> = [];

    const lineItems = invoice.currentVersion?.line_items || [];

    for (const item of lineItems) {
      const amount = Number(item.final_total || 0);
      if (Math.round(amount * 100) === 0) {
        continue;
      }

      result.push({
        internalItemId: `${invoice.reference}:${item.id}`,
        amountCents: Math.round(amount * 100),
        description: this.stripHtml(item.description || 'Line Item'),
        type: 'LINE_ITEM',
      });
    }

    return result;
  }

  public async attachStripeInvoiceItems(
    invoice: any,
    stripeCustomerId: string,
  ): Promise<void> {
    if (!invoice.stripe_invoice_id || !stripeCustomerId) {
      throw new Error('Stripe invoice not initialized');
    }

    const stripeInvoiceId = invoice.stripe_invoice_id;

    // 1. Fetch existing Stripe invoice items
    const existingLines = await this.safeStripeCall(() =>
      this.stripe.invoiceItems.list({
        invoice: stripeInvoiceId,
        limit: 100,
      }),
    );

    // 2. Build deterministic list of items
    const itemsToAttach = await this.buildDeterministicInvoiceItems(invoice);

    if (itemsToAttach.length === 0) {
      return;
    }

    const existingItemIds = new Set(
      existingLines.data
        .map((line) => line.metadata?.internal_item_id)
        .filter(Boolean),
    );

    // 3. Attach only missing items
    for (const item of itemsToAttach) {
      if (existingItemIds.has(item.internalItemId)) {
        continue;
      }

      await this.safeStripeCall(() =>
        this.stripe.invoiceItems.create(
          {
            customer: stripeCustomerId,
            invoice: stripeInvoiceId,
            currency: 'usd',
            amount: item.amountCents,
            description: item.description,
            metadata: {
              internal_item_id: item.internalItemId,
              type: item.type,
            },
          },
          {
            idempotencyKey: `invoice-items-${invoice.reference}-${item.internalItemId}`,
          },
        ),
      );
    }

    // Update state in DB
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripe_status: 'all_line_items_added',
      },
    });
  }

  public async finalizeStripeInvoice(invoice: any): Promise<void> {
    if (!invoice.stripe_invoice_id) {
      throw new Error('Stripe invoice not initialized');
    }

    const stripeInvoiceId = invoice.stripe_invoice_id;

    // 1. Guard: fetch Stripe invoice state
    const stripeInvoice = await this.safeStripeCall(() =>
      this.stripe.invoices.retrieve(stripeInvoiceId),
    );

    if (stripeInvoice.status !== 'draft') {
      return;
    }

    // 2. Resolve all applicable discounts deterministically
    const discounts: any[] = [];

    const discountVal = (invoice as any).discount || (invoice.currentVersion as any)?.discount;
    if (discountVal && Number(discountVal) > 0) {
      const coupon = await this.createInvoiceDiscount(
        Number(discountVal),
        invoice.organization_id,
        'Discount',
      );
      if (coupon) {
        discounts.push({ promotion_code: coupon.id });
      }
    }

    const allianceCreditVal = (invoice as any).allianceCredit || (invoice.currentVersion as any)?.allianceCredit;
    if (
      allianceCreditVal &&
      !Number.isNaN(Number(allianceCreditVal)) &&
      Number(allianceCreditVal) > 0
    ) {
      const coupon = await this.createInvoiceDiscountDollar(
        Number(allianceCreditVal),
        invoice.organization_id,
        'Alliance credit',
      );
      if (coupon) {
        discounts.push({ promotion_code: coupon.id });
      }
    }

    const discountDollarVal = (invoice as any).discountDollar || (invoice.currentVersion as any)?.discountDollar;
    if (discountDollarVal && Number(discountDollarVal) > 0) {
      const coupon = await this.createInvoiceDiscountDollar(
        Number(discountDollarVal),
        invoice.organization_id,
        'Discount',
      );
      if (coupon) {
        discounts.push({ promotion_code: coupon.id });
      }
    }

    // 3. Apply discounts ONCE
    if (discounts.length > 0) {
      await this.safeStripeCall(() =>
        this.stripe.invoices.update(
          stripeInvoiceId,
          { discounts },
          {
            idempotencyKey: `apply-discounts-${invoice.reference}`,
          },
        ),
      );
    }

    // 4. Finalize invoice (idempotent)
    await this.safeStripeCall(() =>
      this.stripe.invoices.finalizeInvoice(
        stripeInvoiceId,
        {},
        {
          idempotencyKey: `finalize-invoices-${invoice.reference}`,
        },
      ),
    );

    // Update state in DB
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripe_status: 'finalized',
      },
    });
  }

  public async verifyFinalizedStripeInvoice(
    invoice: any,
  ): Promise<void> {
    if (!invoice.stripe_invoice_id) {
      throw new Error('Stripe invoice not initialized');
    }

    const stripeInvoiceId = invoice.stripe_invoice_id;

    // 1. Fetch Stripe invoice
    const stripeInvoice = await this.safeStripeCall(() =>
      this.stripe.invoices.retrieve(stripeInvoiceId),
    );

    // 2. Terminal Stripe states
    if (stripeInvoice.status === 'void') {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          stripe_status: 'voided',
        },
      });
      return;
    }

    if (stripeInvoice.status === 'uncollectible') {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          stripe_status: 'uncollectible',
        },
      });
      return;
    }

    // 3. Not finalized yet
    if (stripeInvoice.status === 'draft') {
      throw new Error('Stripe invoice still in draft');
    }

    // 4. Structural verification
    const lineCount = stripeInvoice.lines?.data?.length ?? 0;
    const total = stripeInvoice.total ?? 0;

    if (lineCount === 0) {
      throw new Error('Finalized invoice has no line items');
    }

    if (total <= 0) {
      throw new Error('Finalized invoice has invalid total');
    }
  }

  public async getInvoiceUrl(stripeInvoiceId: string): Promise<{ url: string | null }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not initialized');
    }
    const invoice = await this.safeStripeCall(() =>
      this.stripe.invoices.retrieve(stripeInvoiceId)
    );
    return { url: invoice.hosted_invoice_url || null };
  }
}
