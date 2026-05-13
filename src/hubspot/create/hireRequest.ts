import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  HubspotAuditAction,
  HubspotAuditSource,
  HubspotEntityType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HubspotAuditService } from '../hubspot-audit.service';

@Injectable()
export class HireRequestCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: HubspotAuditService,
  ) {}

  async getOwnerId(userId: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.uSER.findUnique({
      where: { id: userId },
      select: {
        id: true,
        hubspot_id: true,
        first_name: true,
        last_name: true,
        email: true,
      },
    });

    /* => Commented because we cannot create owners using hubspot API
      if (user && !user.hubspot_id) {
      await this.ownerCreationService.execute(user)
      }
      */

    return user && user.hubspot_id ? user.hubspot_id : null;
  }

  async execute(data: any, actorUserId?: string): Promise<any> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      const pay_range =
        data.salary_range_from && data.salary_range_to
          ? `${data.salary_range_from} - ${data.salary_range_to}`
          : '';
      //console.log("Data arriving on HireRequestCreationService:", data);
      const hrDescription = data.description ? data.description : '';

      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/tickets',
        {
          properties: {
            subject: data.title,
            content: data.request_role
              ? 'Requested Role: ' + data.request_role + ' | ' + hrDescription
              : hrDescription,
            hs_pipeline: '0', //=>Pairing Pipeline
            hs_pipeline_stage: '1', //=> New agent Request
            pairing_request_type:
              data.hubspot_pairing_request_type || 'New Client',
            ticket_type: 'Agent Pairing Request',
            business_unit: data.organization.business_unit || 'MedVirtual', // we need to send one business unit
            company_name: data.organization.name,
            client_name: data.organization.name,
            company_url: data.organization.website_url || 'Not Specified',
            va_deployment_type:
              data.availability === 'part-time' ? 'Part-Time' : 'Full-Time',
            hs_ticket_priority: data.priority.toUpperCase(),
            va_type: data.hubspot_role_type,
            contract_amount: data.hubspot_contract_amount,
            language: data.hubspot_language,
            number_of_vas: data.hubspot_numberVA.toString(),
            va_pay_rate_range: pay_range.toString(),
            tasks: data.hubspot_tasks ? data.hubspot_tasks : undefined,
            n2_monitors_required_: data.hubspot_n2_monitors_required,
            va_shift_hours: data.hubspot_va_shift_hours
              ? data.hubspot_va_shift_hours
              : undefined,
            tools_familiarization: data.hubspot_tools_familiarization
              ? data.hubspot_tools_familiarization
              : undefined,
            training_request_notes_: data.hubspot_training_request_notes
              ? data.hubspot_training_request_notes
              : undefined,
            camera_on_shift: data.hubspot_camera_on_during_shift
              ? data.hubspot_camera_on_during_shift
              : undefined,
            special_sourcing_needed:
              data.hubspot_special_sourcing_needed === 'Yes' ? 'true' : 'false',
            special_requirements: data.hubspot_special_requirements
              ? data.hubspot_special_requirements
              : undefined,
            additional_training_requested:
              data.hubspot_additional_training_requested
                ? data.hubspot_additional_training_requested
                : undefined,
            pairing_date: data.hubspot_pairing_date
              ? data.hubspot_pairing_date
              : undefined, //  milisecnonds in timestamp,
            pairing_time: data.hubspot_pairing_time
              ? data.hubspot_pairing_time
              : undefined,
            client_signed_contract:
              data.client_signed_contract_ticket_submission
                ? data.client_signed_contract_ticket_submission
                : undefined,
            expected_start_date: data.expected_start_date
              ? data.expected_start_date
              : undefined,
            background_requirements_of_candidate:
              data.background_requirements_of_candidate
                ? data.background_requirements_of_candidate
                : undefined,

            //ticketOwner
            hubspot_owner_id: data.assign_user_id
              ? await this.getOwnerId(
                  data.assign_user_id.length > 0
                    ? data.assign_user_id[0].id
                    : null,
                )
              : undefined,
            //pairing_specialist
            pairing_specialist: data.assign_sourcing_id
              ? await this.getOwnerId(data.assign_sourcing_id)
              : undefined,
            //hire_date__start_of_employment_: PairingDate, 'expected_start_date', => issue form hubspot saying 'Enter a date before ${currentDate}':
          },
          associations: data.organization.hubspot_id
            ? [
                {
                  to: { id: data.organization.hubspot_id },
                  types: [
                    {
                      associationCategory: 'HUBSPOT_DEFINED',
                      associationTypeId: 26, // 26 = association ticket → organization
                    },
                  ],
                },
              ]
            : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      //console.log(response.data);
      //update hireRequest with the hubspot_ticket_id
      await this.prisma.hireRequest.update({
        where: { id: data.id },
        data: { hubspot_ticket_id: response.data.id },
      });

      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.hire_request,
        entityId: data.id,
        hubspotObjectId: response.data.id,
        hubspotObjectType: 'tickets',
        action: HubspotAuditAction.CREATE,
        source,
        success: true,
        payload: {
          title: data.title,
          organizationId: data.organization?.hubspot_id,
        },
        response: { id: response.data.id },
      });

      return true;
    } catch (error) {
      if (error.response) {
        console.error('Error to created ticket:', error.response.data);
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.hire_request,
        entityId: data.id,
        hubspotObjectType: 'tickets',
        action: HubspotAuditAction.CREATE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
      });
    }
  }
}
