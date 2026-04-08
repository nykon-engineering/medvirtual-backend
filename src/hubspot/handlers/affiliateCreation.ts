import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import * as jwt from 'jsonwebtoken';

import { PrismaService } from "../../prisma/prisma.service";
import { AffiliateStatus, Prisma } from "@prisma/client";
import { getUserEmailTheme } from "../../common/utils/email-templates/theme-helper";
import InviteSignup from "../../common/utils/email-templates/invite-signup";
import { MailService } from "../../mail/mail.service";


@Injectable()
export class HandlerAffiliateCreation {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ){}

    private buildFromWithPrefix(from: string): string {
        const isProduction = process.env.ENVIRONMENT === 'PROD';
        return isProduction ? from : `[DEV] ${from}`;
    }


    async execute(event){
        try{
            const getObject = await axios.get(`https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_GROWTH_PARTNER_CUSTOM_OBJECT}/${event.objectId}?properties=growth_partner_name,growth_partner_email_address,hs_pipeline_stage`, 
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            )
            if (!getObject) {
                throw new BadRequestException('No object data found');
            }
            console.log('Fetched object data from HubSpot:', getObject.data);
            const rawProperties = getObject.data.properties;
            const affiliateData: Record<string, any> = {};

            if (rawProperties.hs_pipeline_stage !== '1329693870') { // 1329693870 is the Alliance Partner Pipeline
                return true; // Not qualified, let's skip creation
            }

            const existingAffiliate = await this.prisma.affiliateProfile.findUnique({
                where: {
                    hubspot_id: rawProperties.hs_object_id,
                },
                select: {
                    id: true,
                }
            })
            
            if (existingAffiliate) {
                return true; // Affiliate already exists, let's skip creation
            }

            affiliateData.hubspot_id = rawProperties.hs_object_id;

            const email = rawProperties.growth_partner_email_address;
            if (!email) {
                return true;
            }

            let user = await this.prisma.uSER.findUnique({
                where: { email },
            })

            if (!user) {
                user = await this.prisma.uSER.create({
                    data: {
                        email,
                        first_name: rawProperties.growth_partner_name.split(' ')[0] || '',
                        last_name: rawProperties.growth_partner_name.split(' ')[rawProperties.growth_partner_name.split(' ').length - 1] || '',
                        phone: '',
                        avatar: '',
                        organization_name: '',
                        role: 'affiliate',
                        job_title: '',
                        workos_id: '',
                        password: '',
                        authentication_method: 'OwnSign',
                        status: 'invited'
                    }
                });

                // Generate invitation token
                const code = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
                expiresIn: '48h',
                });
        
                // Get user email theme
                const emailTheme = await getUserEmailTheme(this.prisma, user.id);
                
                // Send signup link via email
                const baseInviteLink = `${process.env.FRONTEND_URL}/invite-signup?code=${code}`;
                const inviteLink = emailTheme?.companyName === 'Berry Virtual' 
                ? `${baseInviteLink}&company=berry` 
                : baseInviteLink;
                const emailBody = InviteSignup(inviteLink, emailTheme || undefined);
                const mailSent = await this.mailService.sendMail({
                from: this.buildFromWithPrefix(`${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`),
                to: email,
                subject: `Welcome to ${emailTheme?.companyName || 'MedVirtual'} - Complete Your Affiliate Account Setup`,
                html: emailBody,
                headers: {
                    'X-Mailer': `${emailTheme?.companyName || 'MedVirtual'} Platform`,
                    'X-Priority': '3',
                    'List-Unsubscribe': '<mailto:unsubscribe@medvirtual.ai>',
                    'X-Entity-Ref-ID': `invite-${user.id}`,
                },
                });
        
                if (!mailSent) {
                    throw new BadRequestException('Failed to send invitation email');
                }
        
                // Store the verification code in the database with an expiration time
                const codeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours - same time as JWT
                const storeCode = await this.prisma.emailInvitation.create({
                data: {
                    userId: user.id,
                    email_from: email,
                    code: code,
                    expiresAt: codeExpiresAt,
                },
                });
                if (!storeCode) {
                    throw new BadRequestException('Failed to store invite code');
                }
            }
            
            await this.prisma.affiliateProfile.create({
                data: {
                    full_name: rawProperties.growth_partner_name,
                    hubspot_id: rawProperties.hs_object_id,
                    commission_percent_default: 7.0,
                    status: AffiliateStatus.active,
                    user: {
                        connect: {id: user.id},
                    }
                },
            });

            return true;

        }catch (error) {
            console.error('Error processing HubSpot affiliate creation event:', error);
            throw new BadRequestException(`Error fetching object creation data: ${error.message}`);
        }


    }
}