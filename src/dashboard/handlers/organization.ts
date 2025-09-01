/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { count } from 'console';

@Injectable()
export class HandlerOrganization {
  constructor(private readonly prisma: PrismaService) {}

  async execute(user): Promise<object> {
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

    if (!user || !user.organization_id)
      throw new BadRequestException('User or organization not found');

    const hiredStaff = await this.prisma.staff.findMany({
      where:{
        hireRequest:{
          org_id: user.organization_id,
        }
      }, 
      select:{
        id: true,
        candidate: {
          select:{
            first_name: true,
            last_name: true,
            name: true,
            email: true,
            country: true,
            hourly_pay_rate: true,
            organization_id: true,
          }
        },
      }
    })
    const objectHired = hiredStaff.map((staff) => ({
      id: staff.id,
      first_name: staff.candidate.first_name,
      last_name: staff.candidate.last_name,
      name: staff.candidate.name,
      email: staff.candidate.email,
      country: staff.candidate.country,
      hourly_pay_rate: staff.candidate.hourly_pay_rate,
      organization_id: staff.candidate.organization_id,
    }));

    result.hiredStaff = objectHired;

    const hireRequest = await this.prisma.hireRequest.findMany({
      where: {
        org_id: user.organization_id,
        status: 'awaiting_decision',
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        panels: {
          select: {
            id: true,
            status: true,
            scheduled_date: true,
            createdAt: true,
            panelCandidates: {
              select: {
                id: true,
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    hourly_pay_rate: true,
                    organization_id: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    result.hireRequest = hireRequest;

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
                email: true,
                hourly_pay_rate: true,
                organization_id: true,
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
          },
        },
      },
    });
    result.awaitingDecision = awaitingDecision;

    const otherTalents = await this.prisma.candidate.findMany({
      where: {
        organization_id: null,
      },
      select,
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
    });
    result.otherTalents = otherTalents;

    return result;
  }
}
