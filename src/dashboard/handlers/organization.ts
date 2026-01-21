/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { findMonthlySalary } from '../../common/utils/salary.util';
import { HireRequestService } from '../../hire-request/hire-request.service';
import { dbToStageDictionary } from '../../common/dictionaries/stage-dictionary';
import { changeLabelAvailability } from '../../common/utils/hubspot.util';

@Injectable()
export class HandlerOrganization {
  constructor(private readonly prisma: PrismaService, private readonly hireRequestService: HireRequestService) {}

  async execute(user, page: number = 1, perPage: number = 10): Promise<object> {
    const result: any = {};
    //this variable will be used to otherTalents
    const select = {
      id: true,
      first_name: true,
      last_name: true,
      name: true,
      email: true,
      country: true,
      employment_type: true,
      hourly_pay_rate: true,
      years_of_experience: true,
      pipeline_status: true, // This will be converted to name later
      about_me: true,
      specialization: true,
      tools: true,
      medical_tools: true,
      avatar_url: true,
      gender: true,
      approved_positions_pairing: true,
      video_link: true,
      languages: {
        select: {
          name: true,
        },
      },
      skills: {
        select: {
          skill_name: true,
        },
      },
      experiences: {
        select: {
          id: true,
          company: true,
          position: true,
          responsabilities: true,
          end_date: true,
          start_date: true,
        }
      },
      educations: {
        select: {
          degree: true,
          institution: true,
          year: true,
        }
      }
    };

    if (!user || user.role.includes("organization") && !user.organization_id)
      throw new BadRequestException('User or organization not found');


    


    const hiredStaff = await this.prisma.staff.findMany({
      where:{
        status: {
          not: { in: ['terminated', 'inactive'] },
        },
        OR:[
          {
            hireRequest:{
              org_id: user.organization_id,
            }
          },
          {
            organization_id: user.organization_id,
          },
        ]
        
      }, 
      select : {
        id: true,
        hirerequest_id: true,
        status: true,
        salary: true,
        start_date: true,
        created_at: true,
        updated_at: true,
        hubspot_id: true,
        hubspot_close_date: true,
        hubspot_deal_name: true,
        hubspot_dealstage: true,
        hubspot_dealtype: true,
        hubspot_deployment_type: true,
        hubspot_description: true,
        hubspot_hs_acv: true,
        hubspot_pipeline: true,
        hubspot_business_unit: true,
        hubspot_candidate_id: true,
        hubspot_organization_id: true,
        candidate:{
          select:{
            id: true,
            first_name: true,
            last_name: true,
            name: true,
            email: true,
            specialization: true,
            employment_type: true,
            country: true,
            about_me: true,
            hourly_pay_rate: true,
            avatar_url: true,
            gender: true,
            languages: {
              select: {
                name: true,
              }
            },
            skills:{
              select:{
                skill_name: true,
              }
            },
            createdAt: true,
          }
        },
        hireRequest: {
          select:{
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            availability: true,
            contract_length: true,
            expected_start_date: true,
            salary_range_from: true,
            salary_range_to: true,
            specialization: true,
            location: true,
          }
        },
        bonus:{
          select:{
            id: true,
            amount: true,
            description: true,
            created_at: true,
            created_by: true,
          }
        }
      }
    })

    const hiredStaffWithAvatar = hiredStaff.map((staff) => ({
      ...staff,
      candidate: {
        ...staff.candidate,
        avatar: staff.candidate?.avatar_url ? `${process.env.AVATAR_URL}${staff.candidate.avatar_url}` :  null,
      }
    }))

    result.hiredStaff = hiredStaffWithAvatar;
    
    // New: use HireRequestService to bring the same shape as /hire-request (includes specialization and skills)
    const hireRequestsResult = await this.hireRequestService.findAll(user, undefined, page, perPage);
    result.hireRequests = hireRequestsResult;

    const awaitingDecision = await this.prisma.candidatePanel.findMany({
      where: {
        status: 'decision_pending',
        hireRequest: {
          org_id: user.organization_id,
        },
      },
      select: {
        id: true,
        scheduled_date: true,
        status: true,
        
        panelCandidates: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            candidate: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                name: true,
                email: true,
                specialization: true,
                country: true,
                employment_type: true,
                about_me: true,
                years_of_experience: true,
                hourly_pay_rate: true,
                organization_id: true,
                processing_status: true,
                processing_error: true,
                educations: true,
                experiences: true,
                skills:true,
                languages: true,
                approved_positions_pairing: true,
                avatar_url: true,
              },
            },
          },
        },
        hireRequest: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            createdAt: true,
            availability: true,
            contract_length: true,
            expected_start_date: true,
            salary_range_from: true,
            salary_range_to: true,
            specialization: true,
            location: true,
            hubspot_role_type: true,
          },
        },
      },
    });

    //change candidate employment_type and calculate salary
    const awaitingDecisionSanitized = awaitingDecision.map((item) => ({
      ...item,
      panelCandidates: item.panelCandidates.map((pc) => ({
        ...pc,
        candidate: {
          ...pc.candidate,
          employment_type: changeLabelAvailability(dbToStageDictionary[Number(pc.candidate.employment_type)]) || pc.candidate.employment_type,
          salary: findMonthlySalary(Number(pc.candidate?.hourly_pay_rate),
            pc.candidate.languages.length > 1 ? 'Bilingual' : pc.candidate.languages[0]?.name ,
            pc.candidate.approved_positions_pairing && pc.candidate.approved_positions_pairing.length > 0 ? pc.candidate.approved_positions_pairing[0] : ''),
          avatar: pc.candidate?.avatar_url ? `${process.env.AVATAR_URL}${pc.candidate.avatar_url}` :  null,
        }
      }))
    }));

    result.awaitingDecision = awaitingDecisionSanitized;

    const otherTalents = await this.prisma.candidate.findMany({
      where: {
        organization_id: null,
        about_me: { not: null },
        OR: [
          {
            pipeline_status: '261075105'
          },
          {
            pipeline_status: '1087596819'
          }
        ]
      },
      select,
      take: 9,
    });
    const lastTimeofDay = new Date();
    lastTimeofDay.setHours(23, 59, 59, 999);

    const interviews = await this.prisma.interview.findMany({
      where:{
       panel: {
        hireRequest:{
          org_id: user.organization_id,
        }
       },
       scheduled_date: {
        gte: new Date(),
        lte: lastTimeofDay
       },
       alert_closed: false,
      },
      select:{
        id: true,
        scheduled_date: true,
        link: true,
        alert_closed: true,
        panel:{
          select:{
            hireRequest:{
              select:{
                title: true,
              }
            }
          }
        }
      }
    })
    const interviewSanitized = interviews.map((interview) => ({
      ...interview,
      hireRequestTitle: interview.panel.hireRequest.title,
    }))

    result.interviews = interviewSanitized;

    const otherTalentsSalary = otherTalents.map((talent) => ({
      ...talent,
      employment_type: changeLabelAvailability(dbToStageDictionary[Number(talent.employment_type)]) || talent.employment_type,
      salary: findMonthlySalary(Number(talent?.hourly_pay_rate),
        talent.languages.length > 1 ? 'Bilingual' : talent.languages[0]?.name ,
        talent.approved_positions_pairing && talent.approved_positions_pairing.length > 0 ? talent.approved_positions_pairing[0] : ''),
      avatar: talent?.avatar_url ? `${process.env.AVATAR_URL}${talent.avatar_url}` :  null,
    }))
    result.otherTalents = otherTalentsSalary;

    return result;
  }
}
