import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HireRequestStatus, USER } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { HubspotService } from '../hubspot/hubspot.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';
import { changeStatusHireRequesDTO } from './dto/changeStatus-hire-request.dto';
import { reassignDTO } from './dto/reassign-hire-request.dto';
import { ConfirmPanelHireRequestDto } from './dto/confirm-panel-hire-request.dto';
import { panelReadyDTO } from './dto/panelReady-hire-request.dto';
import { returnGetPanelDto } from './dto/return-getPanel.dto';
import { scheduleInterviewDTO } from './dto/schedule-interview.dto';
import { awaitingDecisionDTO } from './dto/awaiting-decision.dto';
import { changeWinnerDTO } from './dto/change-winner.dto';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import {
  findHourlySalary,
  findMonthlySalary,
} from '../common/utils/salary.util';
import { changeLabelAvailability, mapHRTicketToDb } from '../common/utils/hubspot.util';
import axios from 'axios';
import { HRTicketStatus } from '../common/dictionaries/HRTicket-dicionary';
import { title } from 'process';

@Injectable()
export class HireRequestService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef (() => HubspotService))
    private readonly hubspot: HubspotService,
    private readonly notifications: NotificationsService,
  ) {}

  private async verifyAssignUser(statusTo, hireRequest_id): Promise<boolean> {
    const hireRequest = await this.prisma.hireRequest.findUnique({
        where: { id: hireRequest_id },
        select: {
          assign_user_id: true,
        }
      });

      if (statusTo==='pending_signature' || statusTo === 'new' || statusTo === 'cancelled'){
        return true;
      }else{
        if (hireRequest?.assign_user_id) {
          return true;
        }else{
          throw new BadRequestException(`Status ${statusTo} requires an assigned user`);
        }
      }
  }

  private async updateHireRequestStatus(id: string, status: HireRequestStatus): Promise<boolean> {
    const updatedRequest = await this.prisma.hireRequest.update({
      where: {
        id: id,
      },
      data: {
        status: status as HireRequestStatus,
      },
    });
    return true;
  }

  async create(data: CreateHireRequestDto, user?: USER):Promise<any> {   //user is option because the webhook use this function without user
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const {skills, client_id,  ...hireRequestData} = data;

    if( user.role.includes('system') && !client_id) throw new BadRequestException('Client ID is required for system users');

    let whereCondition;
    if (user.role.includes('organization')) {
      //get organization_id from user
      whereCondition = { id: user.organization_id };
    }else if (user.role.includes('system')) {
      //the frontend send me the client_id
      whereCondition = { id: data.client_id };
    }

    const organizationSQL = await this.prisma.organization.findUnique({
      where: whereCondition,
      select:{
        status: true,
        organization_role: true,
        admin_id: true,
        name: true,
        industry: true,
        website_url: true,
        phone: true,
        business_unit: true,

      }
    });
    if (!organizationSQL) throw new NotFoundException(`Organization from client not found`);

    const content = `CLIENT : ${organizationSQL.name} ${organizationSQL.industry && `\n\nINDUSTRY: `+organizationSQL.industry} ${organizationSQL.website_url && `\n\nWEBSITE:`+organizationSQL.website_url}  ${data.numberVA && `\n\nHOW MANY VA'S NEEDED:`+data.numberVA} \n\nTARGET START DATE: ${new Date(data.expected_start_date).toLocaleDateString()}\n\nTITLE: ${organizationSQL.name} ${data.description && `\n\nDESCRIPTION: `+data.description}\n\nAVAILABILITY: ${data.availability}${data.skills && `\n\nSKILLS: `+(data.skills ?? []).map(s => s.name ?? s).join(", ")}`;

    const hubspotMappedFields = mapHRTicketToDb({
      hs_pipeline: '0',
      hs_pipeline_stage: Object.keys(HRTicketStatus)
      .find(key => HRTicketStatus[key] === 'New Agent Request'), //=> New agent Request
      pairing_request_type: 'New Client',
      ticket_type: 'Agent Pairing Request',
      business_unit: organizationSQL.business_unit || "Not Specified",
      company_name: organizationSQL.name,
      client_name: organizationSQL.name,
      company_url: organizationSQL.website_url || "Not Specified",
      va_type: hireRequestData.position,
      contract_amount: hireRequestData.contract_amount,
      language: hireRequestData.language,
      number_of_vas: Number(hireRequestData.numberVA),
    });

    const sanitizeDecimal = (value?: string | null) => {
      return value && value.trim() !== "" ? value : null;
    };
    const hubspotTitle = `HR - ${organizationSQL.name} - ${hireRequestData.numberVA.toString()} - ${hireRequestData.position} - ${data.availability.toUpperCase()}`;

    const hireRequest = {
      ...hireRequestData,
      ...hubspotMappedFields,
      title: hubspotTitle,
      organization: user.role.includes('organization') ?  {connect: {id: user.organization_id || undefined}} : { connect : { id: client_id } },
      //removed the status pending signature asked by Pauli: https://regenta-company.monday.com/boards/9328303960/pulses/18070949199
      //status: organizationSQL.organization_role !== OrganizationRole.client ? 'pending_signature' as HireRequestStatus : 'new' as HireRequestStatus,
      status: HireRequestStatus.new,
      description: data.description,
      assigned_user: organizationSQL.admin_id ? { connect: { id: organizationSQL.admin_id } } : undefined,
      createdBy: { connect: { id: user.id } },
      position: undefined,
      contract_amount: undefined,
      language: undefined,
      numberVA: undefined,
      salary_range_from: sanitizeDecimal(hireRequestData.salary_range_from),
      salary_range_to: sanitizeDecimal(hireRequestData.salary_range_to),
    };

    const newHireRequest = await this.prisma.hireRequest.create({
      data: hireRequest,
    })
    if (!newHireRequest) throw new BadRequestException(`Hire request not created`);
    
    // Notify assigned user via email (non-blocking)
    if (newHireRequest.assign_user_id) {
      console.log(`[notifications] Attempting to send hire request created notification for HR ${newHireRequest.id} to user ${newHireRequest.assign_user_id}`);
      try {
        const result = await this.notifications.notifyHireRequestCreated(newHireRequest.id);
        console.log(`[notifications] Hire request created notification sent successfully:`, result);
      } catch (err) {
        console.error('[notifications] hire-request-created email failed', err?.message || err);
      }
    } else {
      console.log(`[notifications] No assigned user for hire request ${newHireRequest.id}, skipping notification`);
    }
    
    if (skills && skills.length > 0) {
      const newHireRequestSkills = await this.prisma.hireRequestSkill.createMany({
        data: skills.map(skill => ({
          skill_name: skill.name,
          required_level: skill.level,
          hire_request_id: newHireRequest.id,
        })),
      });
      if (!newHireRequestSkills) throw new BadRequestException(`Hire request skills not created`);
    }

    //create Panel with default user_id
    const panel = await this.prisma.candidatePanel.create({
      data: {
        hire_request_id: newHireRequest.id,
        readable: false,
        
      }
    })
    if (!panel) throw new BadRequestException(`Hire request panel not created`);
    const hireRequestWithSkills = await this.findOne(newHireRequest.id, user);    
    //send request for the hubspot to create the ticket
    try {
      await this.hubspot.createHireRequestInHubspot(hireRequestWithSkills);
    } catch (err) {
      console.warn('[hubspot] createHireRequestTicket failed', err?.message || err);
    }

    const hireRequestWithHubspotID = await this.findOne(newHireRequest.id, user);
    return hireRequestWithHubspotID;
  }

  async findAll(user: USER, search?: string, page: number = 1, perPage: number = 10): Promise<any> {
    
    if (!user || user.role.includes("organization") && !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }
    if(!user.role) throw new NotFoundException('User role not found');

    let baseWhere = {};
    switch (user.role) {
      case 'organization_super_admin':
      case 'organization_admin':
        baseWhere = { organization: { id: user.organization_id } };
        break
      
      /* => https://regenta-company.monday.com/boards/9328303960/pulses/18312697982/posts/4649194899?reply=reply-4651095908
      case 'system_admin':
        baseWhere={ OR: [
          { organization: { admin_id: user.id }},
          { assigned_user: {id: user.id}}
        ]}
        break;
      */
      case 'system_super_admin':
      case 'system_admin':
        baseWhere = {};
        break;
    }

    //this code was updated for the switch above
    // baseWhere = user.role.includes('organization') ? { organization: { id: user.organization_id } } : {};
    const searchWhere = search ? { title: { contains: search, mode: 'insensitive' as const } } : {};
    const whereClause =  { ...baseWhere, ...searchWhere } ;

    const skip = (page - 1) * perPage;
    const take = perPage;

    const [hireRequests, total] = await this.prisma.$transaction([
      this.prisma.hireRequest.findMany({
        where: whereClause,
        include: {
          skills: true,
          organization: true,
          assigned_user:{
            select: {
              id: true,
              first_name: true,
              last_name: true,
            }
          },
          assigned_sourcing: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            }
          },
          panels: {
            select: {
              id: true,
              status: true,
              scheduled_date: true,
              readable: true,
              panelCandidates: {
                select: {
                  id:true,
                  candidate: {
                    select: {
                      id: true,
                      first_name: true,
                      last_name: true,
                      name: true,
                      email: true,
                      country: true,
                      languages: true,
                      specialization: true,
                      about_me: true,
                      hourly_pay_rate: true,
                      avatar_url: true,
                      approved_positions_pairing: true,
                      skills: {
                        select: {
                          skill_name: true,
                          proficiency_level: true,
                        },
                      },
                      educations: {
                        orderBy: { year: 'desc' },
                        select: {
                          institution: true,
                          degree: true,
                          year: true,
                        },
                      },
                      experiences: {
                        orderBy: { start_date: 'desc' },
                        select: {
                          company: true,
                          position: true,
                          responsabilities: true,
                          start_date: true,
                          end_date: true,
                        },
                      },
                      panelCandidates: {
                        select:{
                          id: true,
                          status: true,
                          panel:{
                            select:{
                              id: true,
                              hire_request_id: true,
                              hireRequest:{
                                select:{
                                  id: true,
                                  title: true,
                                  organization:{
                                    select:{
                                      id: true,
                                      name: true,
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    },
                  },
                },
              },
              interviews: {
                select: {
                  scheduled_date: true,
                  link: true,
                },
              },
            },
          }
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      this.prisma.hireRequest.count({ where: whereClause })
    ]);

    if(!hireRequests || hireRequests.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          perPage,
          totalPages: 0
        }
      };
    }

    const formatted = hireRequests.map(hr => ({
      ...hr,
      panels: hr.panels.map(panel => ({
        ...panel,
        interview_date: panel.interviews[0]?.scheduled_date || null,
        interview_link: panel.interviews[0]?.link || null,
        interviews: undefined,
        panelCandidates: panel.panelCandidates.map(pc => ({
          ...pc,
          candidate:{
            ...pc.candidate,
            salary: findMonthlySalary(pc.candidate.hourly_pay_rate?.toNumber() || 0),
            avatar: pc.candidate.avatar_url ? `${process.env.AVATAR_URL}${pc.candidate.avatar_url}` :  null,
            panelCandidates: pc.candidate.panelCandidates ? pc.candidate.panelCandidates
            .filter(pcc => pcc.panel?.id && pcc.panel.id !== panel.id)
            .map(pcc => ({
              title: pcc.panel.hireRequest.title,
              organization_name: pcc.panel.hireRequest.organization.name,
              status: pcc.status,
            })) : [],
          }
        }))
      }))
    }));

    return {
      data: formatted,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
      }
    };
    

  }

  async findOne(id: string, user: USER): Promise<any> {
    if (!user || user.role.includes("organization") && !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ?  { id: user.organization_id || undefined } : undefined,
      },
      include: {
        skills: true,
        organization: true,
        assigned_user:{
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        },
        assigned_sourcing: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        },
        panels: {
          select: {
            id: true,
            status: true,
            scheduled_date: true,
            readable: true,
            panelCandidates: {
              select: {
                status: true,
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    name: true,
                    email: true,
                    country: true,
                    employment_type: true,
                    hourly_pay_rate: true,
                    years_of_experience: true,
                    pipeline_status: true,
                    about_me: true,
                    specialization: true,
                    processing_status: true,
                    processing_error: true,
                    organization_id: true,
                    avatar_url: true,
                    languages: {
                      select: {
                        name: true,
                      },
                    },
                    skills: {
                      select: {
                        skill_name: true,
                        proficiency_level: true,
                      },
                    },
                    educations: {
                      orderBy: { year: 'desc' },
                      select: {
                        institution: true,
                        degree: true,
                        year: true,
                      },
                    },
                    experiences: {
                      orderBy: { start_date: 'desc' },
                      select: {
                        company: true,
                        position: true,
                        responsabilities: true,
                        start_date: true,
                        end_date: true,
                      },
                    },
                    selectedInInterviews: {
                      select: {
                        scheduled_date: true,
                      },
                    },
                  },
                },
              },
            },
            interviews: {
              select: {
                scheduled_date: true,
                link: true
              },
            },
          },
        }
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    //Add salary with automatic calculation
    const formatted = {
      ...hireRequest,
      panels: (hireRequest.panels ?? []).map(panel => ({
        ...panel,
        interview_date: panel.interviews[0]?.scheduled_date || null,
        interview_link: panel.interviews[0]?.link || null,
        interviews: undefined,
        panelCandidates: panel.panelCandidates.map(pc => {
          const startDate = pc.candidate.experiences[0]?.start_date;
          const years_of_experience = startDate
          ? new Date().getFullYear() - new Date(startDate).getFullYear()
          : 0;
          return {
            ...pc,
            candidate:{
              ...pc.candidate,
              salary: findMonthlySalary(pc.candidate.hourly_pay_rate?.toNumber() || 0),
              years_of_experience: years_of_experience,
              avatar: pc.candidate.avatar_url ? `${process.env.AVATAR_URL}${pc.candidate.avatar_url}` :  null,
            }}
        })
      }))
    };

    return formatted;
  }

  async update(id: string, data: UpdateHireRequestDto, user: USER): Promise<object> {
    let result;
    if(!user || user.role.includes("organization") && !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }

    const {skills, ...hireRequestData} = data;
    const requestUpdated = await this.prisma.hireRequest.update({
      where: {
        id: id
      },
      data: hireRequestData,
    })
    if (!requestUpdated) throw new BadRequestException(`Hire request not updated`);

    result = requestUpdated;

    //delete all skills independently if the array is empty or not
    await this.prisma.hireRequestSkill.deleteMany({
      where: {
        hire_request_id: id,
      },
    });

    if( skills && skills.length > 0) {
      
      const skillsUpdated = await this.prisma.hireRequestSkill.createMany({
        data: skills.map(skill => ({
          skill_name: skill.name,
          required_level: skill.level,
          hire_request_id: id,
        })),
      });
      if (!skillsUpdated) throw new BadRequestException(`Hire request skills not updated`);

      const newSkills = await this.prisma.hireRequestSkill.findMany({
        where: { hire_request_id: id },
      });
      result.skills = newSkills;
    }

    // Notify assignee via email when hire request is edited (non-blocking)
    const newHr = await this.findOne(id, user);
    await this.hubspot.updateHireRequestInHubspot(newHr);

    try {
      if (user.role.includes('organization')) {
        await this.notifications.notifyHireRequestClientChange(id, 'edited');
      }
    } catch (err) {
      console.warn('[notifications] hire-request-edited email failed', err?.message || err);
    }

    return newHr
  }

  async updateStatus(id: string, data: changeStatusHireRequesDTO, user: USER): Promise<boolean> {
    if (!user || user.role.includes("organization") && !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }

    const assign_user = await this.verifyAssignUser(data.status, id);
    if (!assign_user) {
      throw new BadRequestException(`Status ${data.status} requires an assigned user`);
    }

    if (!data || !data.status) throw new BadRequestException('Data for status change is required');
    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ?  { id: user.organization_id || undefined } : undefined,
      },
      select:{
        status: true,
        hubspot_ticket_id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    const candidates = await this.prisma.panelCandidate.findMany({
      where: {
        panel: {
          hire_request_id: id,
        },
      },
      select: {
        panel_id: true,
        candidate: {
          select: {
            id: true,
            hubspot_id: true,
            pipeline_status: true,
            pipeline_status_origin: true
          }
        }
      },
    })

    const panelExists = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: id,
      },
      include: {
        panelCandidates: true,
        interviews: true,
      }
    });


    if (data.status === 'cancelled'){


      
      if (candidates.length > 0) {
        const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
          return dbToStageDictionary[key] === 'Available Candidates';
        })
        if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Available Candidates`);

        //update candidates for their original status or 'Available Candidates' on database and hubspot
        await Promise.all(
          candidates.map(async c =>{
            const thereOtherPanels = await this.prisma.panelCandidate.findMany({
              where: {
                candidate_id: c.candidate.id,
                status: {
                  in: ['selected_by_client', 'blocked']
                },
                panel: {
                  hire_request_id: {
                    not: id,
                  },
                },
              },
              select: {
                id: true,
              }
            });
            if (thereOtherPanels.length === 0) {
              //only update candidate if he is not in other panels
              const  pipeline_treated = c.candidate.pipeline_status_origin || pipelineStatus;
              await this.prisma.candidate.update({
                where: { id: c.candidate.id },
                data: { pipeline_status: pipeline_treated},
              });
              await this.hubspot.updateOneCandidateFromHireRequest(c.candidate.hubspot_id, pipeline_treated);
            }
            
          }
          )
        );
      }

      //remove all candidates from the panel
      await this.prisma.candidatePanel.deleteMany({
        where: {
          hire_request_id: id,
        },
      })

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      //update hr ticket on hubspot
      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'Pairing Lost'), //=> Pairing Lost
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot to Cancelled failed', err?.message || err);
      }

      // Notify assignee via email when hire request is canceled (non-blocking)
      try {
        if (user.role.includes('organization')) { //just notify if this action is from client
          await this.notifications.notifyHireRequestClientChange(id, 'canceled');
        }
      } catch (err) {
        console.warn('[notifications] hire-request-canceled email failed', err?.message || err);
      }

      return this.findOne(id, user);
      
    }else if (hireRequest.status == 'sourcing' && data.status === 'new' || hireRequest.status == 'cancelled' && data.status === 'new' || hireRequest.status == 'placement_completed' && data.status === 'new'){
      //REOPEN AS NEW
      const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
        return dbToStageDictionary[key] === 'Available Candidates';
      })
      if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Available Candidates`);

      //remove all candidates from the panel
      await this.prisma.candidatePanel.deleteMany({
        where: {
          hire_request_id: id,
        },
      })

      if ( candidates.length > 0 ) {
        //update candidates for their original status or 'Available Candidates' on database and hubspot
        await Promise.all(
          candidates.map(async c =>{
            const  pipeline_treated = c.candidate.pipeline_status_origin || pipelineStatus;
            await this.prisma.candidate.update({
              where: { id: c.candidate.id },
              data: { pipeline_status: pipeline_treated},
            });
            await this.hubspot.updateOneCandidateFromHireRequest(c.candidate.hubspot_id, pipeline_treated);
          }
          )
        );

      }

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      //update hr ticket on hubspot
      try {
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'New Agent Request'), //=> New
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot to Cancelled failed', err?.message || err);
      }

      return this.findOne(id, user);

    } else if (hireRequest.status == 'panel_ready' && data.status === 'sourcing' ||
      hireRequest.status == 'for_review' && data.status === 'sourcing' ||
      hireRequest.status == 'cancelled' && data.status === 'sourcing'){
      //update panel to readable=false
      //update the hireRequest Status to sourcing

      const panelUpdated = await this.prisma.candidatePanel.updateMany({
        where: {
          hire_request_id: id,
        },
        data: {
          readable: false,
        },
      });
      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      //update hr ticket on hubspot
      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'Sourcing Candidates'),
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot to Cancelled failed', err?.message || err);
      }

      try {
        await this.notifications.notifyHireRequestBackToSourcing(id);
      } catch (err) {
        console.warn('[notifications] hire-request Back to sourcing', err?.message || err);
      }
      return this.findOne(id, user);

      
    } else if (hireRequest.status == 'new' && data.status === 'sourcing'){
      //verify if there panel created with this hire_request_id

      if (!panelExists) {
        //create Panel with default user_id
        await this.prisma.candidatePanel.create({
          data: {
            hire_request_id: id,
            readable: false,
          }
        })
      }

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'Sourcing Candidates'),
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot to Cancelled failed', err?.message || err);
      }

      //notify the sourcing assigned user
      try {
        await this.notifications.notifyHireRequestSourcingAssignee(id, 'sourcing');
      } catch (err) {
        console.warn('[notifications] hire-request-canceled email failed', err?.message || err);
      }

      return this.findOne(id, user);
    
    } else if (hireRequest.status == 'sourcing' && data.status === 'for_review'){

      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);
      
      //Pauli asked to remove this rule: https://regenta-company.monday.com/boards/9328303960/pulses/18070949162?notification=6971131519
      if (panelExists.panelCandidates.length < 1) {
        throw new BadRequestException(`Panel must have at least 1 candidates`);
      }
      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      //notify the sourcing assigned user
      try {
        await this.notifications.notifyHireRequestConciergeAssigned(id, 'for_review');
      } catch (err) {
        console.warn('[notifications] hire-request-canceled email failed', err?.message || err);
      }

      return this.findOne(id, user);
    
    } else if (hireRequest.status == 'for_review' && data.status === 'panel_ready'){

      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);
      
      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'Candidates Endorsed'),
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot in Panel ready failed', err?.message || err);
      }

      return this.findOne(id, user);
    
    } else if (hireRequest.status == 'panel_ready' && data.status === 'placement_completed' 
      || hireRequest.status == 'interview_scheduled' && data.status === 'placement_completed'
      || hireRequest.status == 'awaiting_decision' && data.status === 'placement_completed' ){
      
      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);
      const winnerCandidate = panelExists.panelCandidates.find(pc => pc.status === 'selected_by_client');
      if (!winnerCandidate) throw new BadRequestException(`You need to select a candidate as winner before before moving to ${data.status.replace("_"," ").toUpperCase()}`);

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      const updatedPanel = await this.prisma.candidatePanel.update({
        where: {
          id: panelExists.id,
        },
        data: {
          status: 'decision_made',
        }
      })
      if( !updatedPanel) throw new BadRequestException(`Panel not updated`);

      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'For Onboarding (Paired)'),
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot in Awaiting decision failed', err?.message || err);
      }

      // Fire placement completed notification (non-blocking)
      try {
        await this.notifications.notifyHireRequestPlacementCompleted(id);
      } catch (err) {
        console.warn('[notifications] placement-completed email failed', err?.message || err);
      }

      // Fire select winner notification to organization admins (non-blocking)
      try {
        await this.notifications.notifyHireRequestSelectWinner(id);
      } catch (err) {
        console.warn('[notifications] select-winner email failed', err?.message || err);
      }

      return this.findOne(id, user);
    
    } else if (hireRequest.status == 'interview_scheduled' && data.status === 'panel_ready' ){
      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);

      //remove the interview_scheduled panel
      const removeInterview = await this.prisma.interview.deleteMany({
        where:{
          panel_id: panelExists.id,
        }
      });
      if(!removeInterview) throw new BadRequestException(`Interview not removed`);

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      const updatePanel = await this.prisma.candidatePanel.update({
        where: {
          id: panelExists.id,
        },
        data: {
          scheduled_date: null,
        }
      })

      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'Candidates Endorsed'),
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot in Panel ready failed', err?.message || err);
      }


      return this.findOne(id, user);

    } else if (hireRequest.status == 'awaiting_decision' && data.status === 'panel_ready' ){ 
      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);
      //remove the scheduled date => due date to decide
      const updatedPanel = await this.prisma.candidatePanel.update({
        where: {
          id: panelExists.id,
        },
        data: {
          status: 'created',
        }
      })
      if( !updatedPanel) throw new BadRequestException(`Panel not updated`);

      //remove the interview_scheduled panel
      const removeInterview = await this.prisma.interview.deleteMany({
        where:{
          panel_id: panelExists.id,
        }
      });

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);
     
      return this.findOne(id, user);

    /* It was removed on 10-17-2025 asked by Pauli and fouond by Liz - https://regenta-company.monday.com/boards/9328303960/pulses/18193994589
    } else if (hireRequest.status == 'placement_completed' && data.status === 'panel_ready' ){
      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);

      await this.prisma.interview.deleteMany({
        where: {
          panel_id: panelExists.id,
        },
      });

      await this.prisma.panelCandidate.updateMany({
        where: {
          panel_id: panelExists.id,
        },
        data: {
          status: 'selected',
        },
      });

      const panelCandidates = await this.prisma.panelCandidate.findMany({
        where: {
          panel_id: panelExists.id,
        },
        select: {
          candidate: {
            select: {
              id: true,
              hubspot_id: true,
            },
          },
        },
      });

      if (panelCandidates.length > 0) {
        const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
          return dbToStageDictionary[key] === 'Endorsed via Platform';
        });
        if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Endorsed via platform`);

        const candidateIds = panelCandidates.map(pc => pc.candidate.id);
        await this.prisma.candidate.updateMany({
          where: {
            id: {
              in: candidateIds,
            },
          },
          data: {
            pipeline_status: pipelineStatus,
          },
        });

        const candidatesForHubspot = panelCandidates.map(pc => pc.candidate);
        const updateHubspot = await this.hubspot.updateManyCandidatesFromHireRequest(candidatesForHubspot, pipelineStatus);
        if (!updateHubspot) throw new NotFoundException(`Candidates not updated on the hubspot`);
      }

      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      const updatedPanel = await this.prisma.candidatePanel.update({
        where: {
          id: panelExists.id,
        },
        data: {
          status: 'created',
          scheduled_date: null,
        }
      })
      if( !updatedPanel) throw new BadRequestException(`Panel not updated`);

      return this.findOne(id, user);

    */
    } else if (hireRequest.status == 'panel_ready' && data.status === 'interview_scheduled' ){
      if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);

      if( panelExists.interviews.length === 0) {
        throw new BadRequestException(`You need to schedule an interview before changing the status to ${data.status.replace("_"," ").toUpperCase()}`);
      }
      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      const updatedPanel = await this.prisma.candidatePanel.update({
        where: {
          id: panelExists.id,
        },
        data: {
          status: 'interview_scheduled',
        }
      })
      if( !updatedPanel) throw new BadRequestException(`Panel not updated`);

      
      return this.findOne(id, user);

    
    } else if (hireRequest.status == 'panel_ready' && data.status === 'awaiting_decision' 
      || hireRequest.status == 'interview_scheduled' && data.status === 'awaiting_decision' ){
      
      if( !panelExists) throw new NotFoundException(`Panel for this hire request not found`);

      if (!panelExists.scheduled_date){
        throw new BadRequestException(`You need to set a Deadline before changing the status to ${data.status.replace("_"," ").toUpperCase()}`);
      }
      const updatedRequest = await this.updateHireRequestStatus(id, data.status as HireRequestStatus);
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);

      //change the status panel
      const updatedPanel = await this.prisma.candidatePanel.update({
        where: {
          id: panelExists.id,
        },
        data: {
          status: 'decision_pending',
        }
      })
      if( !updatedPanel) throw new BadRequestException(`Panel not updated`);

      try {  
        const dataForHubspot = {
          hubspot_ticket_id: hireRequest.hubspot_ticket_id,
          hubspot_pipeline_stage: Object.keys(HRTicketStatus)
          .find(key => HRTicketStatus[key] === 'Interview Done (For Follow-up)'),
        }
        const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
      } catch (err) {
        console.warn('[hubspot] updateHireRequestInHubspot in Awaiting decision failed', err?.message || err);
      }


      return this.findOne(id, user);
    } else{
      throw new BadRequestException(`Status change from ${hireRequest.status.replace("_"," ").toUpperCase()} to ${data.status.replace("_"," ").toUpperCase()} is not allowed`);
    }
  }

  async reassign(id: string, user: USER, data: reassignDTO, type: string): Promise<any> {
    if (!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    if(!type) throw new BadRequestException('Type of reassignment is required');

    let fieldToUpdate = {};
    if (type === 'concierge'){
      fieldToUpdate = {
        assigned_user: data.user_id
        ? { connect: { id: data.user_id } }
        : { disconnect: true },
      }
    }else if (type === 'sourcing'){
      fieldToUpdate = {
        assigned_sourcing: data.user_id
        ? { connect: { id: data.user_id } }
        : { disconnect: true },
      }
    }

    const hireRequest = await this.prisma.hireRequest.update({
      where: {
        id: id
      },
      data: fieldToUpdate
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    // Notify newly assigned user via email (non-blocking)
    if (data.user_id) {
      console.log(`[notifications] Attempting to send hire request reassigned notification for HR ${id} to user ${data.user_id}`);
      try {
        const result = await this.notifications.notifyHireRequestCreated(id, type);
        console.log(`[notifications] Hire request reassigned notification sent successfully:`, result);
      } catch (err) {
        console.error('[notifications] hire-request-reassigned email failed', err?.message || err);
      }
    } else {
      console.log(`[notifications] No user_id provided for hire request reassignment ${id}, skipping notification`);
    }

    return this.findOne(id, user);
  }

  async showMatchCandidates(id: string, user: USER): Promise<object> {
    if (!user || user.role.includes("organization") && !user.organization_id) 
      throw new NotFoundException('User not found or not part of an organization');
  
    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: { id },
      select: {
        id: true,
        specialization: true,
        location: true,
        availability: true,
        salary_range_from: true,
        salary_range_to: true,
        skills: {
          select: {
            skill_name: true,
            required_level: true,
          },
        },
      },
    });
  
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);
  
    const requiredSkills = hireRequest.skills.map(s => s.skill_name);
  
    const hourly_from = hireRequest.salary_range_from
      ? findHourlySalary(Number(hireRequest.salary_range_from))
      : undefined;
      
    const hourly_to = hireRequest.salary_range_to
      ? findHourlySalary(Number(hireRequest.salary_range_to))
      : undefined;
  
    const candidates = await this.prisma.candidate.findMany({
      where : {
        OR: [
          {pipeline_status: '261075105'},
          {pipeline_status: '1087596819'}
        ]
      },
      select:{
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        name: true,
        about_me: true,
        hourly_pay_rate: true,
        pipeline_status: true,
        country: true,
        specialization: true,
        employment_type : true,
        avatar_url: true,
        gender: true,
        approved_positions_pairing: true,
        languages: {
          select: {
            name: true,
          },
        },
        skills: {
          select: {
            skill_name: true,
            proficiency_level: true,
          },
        },
        experiences: {
          select: {
            company: true,
            position: true,
            responsabilities: true,
            start_date: true,
            end_date: true,
          },
        },
        educations: {
          select: {
            institution: true,
            degree: true,
            year: true,
          },
        },
        panelCandidates: {
          where:{
            panel: {
              hire_request_id: { not: id},
            }
          },
          select:{
            id: true,
            panel:{
              select:{
                hire_request_id: true,
                hireRequest:{
                  select:{
                    id: true,
                    title: true,
                    organization:{
                      select:{
                        id: true,
                        name: true,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      
    });

    const hireRequestSpecialization = hireRequest.specialization ? 
      hireRequest.specialization.split(';').map(s => s.trim()) : [];
    
    //=> score 
    const scoredCandidates = candidates.map(candidate => {
      let score = 0;
  
      if (
        hireRequestSpecialization.length > 0 &&
        candidate.specialization &&
        hireRequestSpecialization.includes(candidate.specialization)
      ) {
        score += 1;
      }
  
      if (hireRequest.location && candidate.country === hireRequest.location) score += 1;
  
      //if (hireRequest.availability && candidate.employment_type === hireRequest.availability) score += 1;
      if (hireRequest.availability){
        if (hireRequest.availability === 'full-time' && candidate.employment_type === '261075105') score += 1;
        if (hireRequest.availability === 'part-time' && candidate.employment_type === '1087596819') score += 1;
      }
  
      if (
        candidate.hourly_pay_rate !== null &&
        hourly_from !== undefined &&
        hourly_to !== undefined &&
        candidate.hourly_pay_rate.toNumber() >= hourly_from &&
        candidate.hourly_pay_rate.toNumber() <= hourly_to
      ) score += 1;
  
      const candidateSkills = candidate.skills.map(s => s.skill_name);
      const matchedSkills = candidateSkills.filter(skill => requiredSkills.includes(skill));
      score += matchedSkills.length;
  
      return {
        ...candidate,
        matchedSkills,
        score,
      };
    });
  
    //order because I need to delivery the best candidates first
    scoredCandidates.sort((a, b) => b.score - a.score);

    //Add salary with automatic calculation
    const candidatesWithSalary = scoredCandidates.map(c => ({
      ...c,
      salary: findMonthlySalary(c.hourly_pay_rate?.toNumber() || 0),
      avatar: c.avatar_url ? `${process.env.AVATAR_URL}${c.avatar_url}` :  null,
      panelCandidates: c.panelCandidates ? c.panelCandidates.map(pc => ({
        title: pc.panel.hireRequest.title,
        organization_name: pc.panel.hireRequest.organization.name,
        
      })) : []
    }))
  
    return candidatesWithSalary;
  }
  
  async confirmPanel(data: ConfirmPanelHireRequestDto, user:USER) : Promise<boolean> {
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.candidates_id) throw new BadRequestException('Data is required to confirm panel');
    //if (data.candidates_id.length !== 5) throw new BadRequestException('Exactly 5 candidates must be selected to confirm panel');

    //check if panel exists
    const panelExists = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: data.hireRequest_id,
      },
      select: {
        id: true,
      },
    });
    if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);

    if( data.candidates_id.length > 0 ) {
      //add each candidate to the panel
      const addCandidates = await this.prisma.panelCandidate.createMany({
        data: data.candidates_id.map(candidateId => ({
          candidate_id: candidateId,
          panel_id: panelExists.id,
        })),
      })
      if (!addCandidates) throw new BadRequestException(`Panel candidates not added`);
    }
    
    //update panel with status = 'sourcing'
    const panelUpdated = await this.prisma.hireRequest.update({
      where: {
        id: data.hireRequest_id,
      },
      data: {
        status: 'sourcing',
      },
    });
    if (!panelUpdated) throw new BadRequestException(`Panel not confirmed`);

    const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Endorsed via Platform';
    })
    //update candidates with pipelinestatus = 'Endorsed via Platform'
    const candidatesUpdated = await this.prisma.candidate.updateMany({
      where: {
        id: {
          in: data.candidates_id,
        },
      },
      data: {
        pipeline_status: pipelineStatus,
      },
    });
    if (!candidatesUpdated) throw new BadRequestException(`Candidates not updated to endorsed`);

    //select candidates
    const candidates = await this.prisma.candidate.findMany({
      where: {
        id: {
          in: data.candidates_id,
        },
      },
      select: {
        id: true,
        hubspot_id: true,
      },
    });
    if( !candidates) throw new NotFoundException(`Candidates not found`);


    //comunicate with hubspot to update status
    const updateHubspot = await this.hubspot.updateManyCandidatesFromHireRequest(candidates, pipelineStatus);
    if (!updateHubspot) throw new NotFoundException(`Loser candidates not updated on the hubspot`);

    return true;
  }

  async editPanel(data: ConfirmPanelHireRequestDto, user: USER) : Promise<boolean> {
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.candidates_id) throw new BadRequestException('Data is required to confirm panel');


    const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Endorsed via Platform';
    })
    if (!pipelineStatus) throw new BadRequestException(`Pipeline status mapping not found`);

    const pipelineStatusOldCandidates = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Available Candidates';
    })
    if (!pipelineStatusOldCandidates) throw new NotFoundException(`Pipeline status mapping not found for Available Candidates`);



    // === Transaction Prisma ===
    const { currentPanel} = await this.prisma.$transaction(async (tx) => {

      let panel = await tx.candidatePanel.findFirst({
        where: { hire_request_id: data.hireRequest_id },
        select: { id: true },
      });

      if (!panel) {
        panel = await tx.candidatePanel.create({
          data: {
            hire_request_id: data.hireRequest_id,
            readable: false,
          },
        });

        const updatedRequest = await this.updateHireRequestStatus(data.hireRequest_id, 'sourcing');
        if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);
      }


      await tx.panelCandidate.deleteMany({
        where: { panel_id: panel.id },
      });

      // Create new candidates on the panel
      await tx.panelCandidate.createMany({
        data: data.candidates_id.map((candidateId) => ({
          candidate_id: candidateId,
          panel_id: panel.id,
        })),
      });

      return { 
        currentPanel: panel,
      };
    });

    
    return this.findOne(data.hireRequest_id, user);
  }

  async panelReady(data: panelReadyDTO, user: USER): Promise<boolean>{
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.hireRequest_id) throw new BadRequestException('Data is required to confirm panel ready');
    
    const panel = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: data.hireRequest_id,
      },
      include: {
        panelCandidates: true,
        
      },
    });

    if (!panel) {
      throw new NotFoundException(`Panel for this hire request not found`);
    }

    //Pauli asked to remove this rule: https://regenta-company.monday.com/boards/9328303960/pulses/18070949162?notification=6971131519
    if (panel.panelCandidates.length < 1) {
      throw new BadRequestException(`Panel must have at least 1 candidates to be marked as ready`);
    }

    await this.prisma.interview.deleteMany({
      where: {
        panel_id: panel.id,
      },
    });

    const candidateIds = panel.panelCandidates.map(pc => pc.candidate_id);
    
    await this.prisma.ticket.updateMany({
      where: {
        type: 'interview',
        candidate_id: {
          in: candidateIds,
        },
        status: {
          in: ['new', 'in_progress'],
        },
      },
      data: {
        status: 'resolved',
      },
    });

    await this.prisma.panelCandidate.updateMany({
      where: {
        panel_id: panel.id,
      },
      data: {
        status: 'selected',
      },
    });

    const hireRequest = await this.prisma.hireRequest.update({
      where: {
        id: data.hireRequest_id,
      },
      data: {
        status: 'panel_ready',
      },
    });
    if (!hireRequest) throw new BadRequestException(`Hire request not updated to panel ready`);

    const panelUpdated = await this.prisma.candidatePanel.updateMany({
      where: {
        hire_request_id: data.hireRequest_id,
      },
      data: {
        readable: data.readable,
        scheduled_date: null,
        status: 'created',
      },
    });
    if (!panelUpdated) throw new BadRequestException(`Panel not updated to readable`);

    //Business logical changed on 2025-11-03 asked by Hanieh and did by Paulo
    const candidates = await this.prisma.candidate.findMany({
      where: { id: {in: candidateIds}},
      select:{
        id: true,
        hubspot_id: true,
        pipeline_status: true,
        pipeline_status_origin: true
      }
    })
    candidates.forEach( async c => {
      await this.prisma.candidate.update({
        where: { id: c.id },
        data: { pipeline_status: c.pipeline_status_origin || c.pipeline_status},
      });
      await this.hubspot.updateOneCandidateFromHireRequest(c.hubspot_id, c.pipeline_status_origin || c.pipeline_status);
    })

    try {
      const result = await this.notifications.notifyHireRequestPanelReady(data.hireRequest_id);
      console.log(`[notifications] Hire request Panel Ready notification sent successfully:`, result);
    } catch (err) {
      console.error('[notifications] hire request Panel Ready failed', err?.message || err);
    }

    return this.findOne(data.hireRequest_id, user);
  }

  async getPanel(id: string, user: USER): Promise<returnGetPanelDto> {
    let result: any = {};
    if(!id) throw new BadRequestException('Hire request ID is required');
    if (!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        org_id: user.role.includes('organization') ?  user.organization_id || undefined: undefined,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    const panel = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
    });
    if (!panel) throw new NotFoundException(`Panel for this hire request not found`);
    result.hireRequest = hireRequest;
    result.panel = panel;

    const panelCandidates = await this.prisma.panelCandidate.findMany({
      where: {
        panel_id: panel.id,
      },
      include: {
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            country: true,
            skills: {
              select: {
                skill_name: true,
              },
            },
            educations: {
              select: {
                institution: true,
                degree: true,
                year: true,
              },
            },
            experiences: {
              select: {
                company: true,
                position: true,
                responsabilities: true,
                end_date: true,
                start_date: true,
              },
            },
          },
        },
      },
    });
    if (!panelCandidates) throw new NotFoundException(`Panel candidates not found`);
    result.panelCandidates = panelCandidates;

    return result;

  }

  async getPanels(user: USER){
    if (!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    /*select all hirerequests to show on the client page "My interview Panels"
    -awaiting_decision + readable = true
    -panel_ready
    */

    const panels = await this.prisma.candidatePanel.findMany({
      where: {
        hireRequest: {
          org_id: user.organization_id || undefined,
        },
        OR: [
          {
            status: 'created',
            readable: true,
          },
          {
            status: 'interview_scheduled',
            readable: true,
          },
          {
            status: 'decision_pending',
          },
          {
            status: 'decision_made',
          },
        ],
       
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
                pipeline_status: true,
                avatar_url: true,
                gender: true
              },
            },
          },
        },
        interviews: {
          select: {
            scheduled_date: true,
            link: true,
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


    const result = panels.map(panel => ({
      ...panel,
      interview_date: panel.interviews[0]?.scheduled_date || null,
      interview_link: panel.interviews[0]?.link || null,
      interviews: undefined,
      panelCandidates: panel.panelCandidates.map(pc => ({
        ...pc,
        candidate: {
          ...pc.candidate,
          salary: findMonthlySalary(pc.candidate.hourly_pay_rate ? pc.candidate.hourly_pay_rate.toNumber() : 0),
          avatar: pc.candidate.avatar_url ? `${process.env.AVATAR_URL}${pc.candidate.avatar_url}` :  null,
        }
      }))
      
    }));
    
    return result;
  }

  async getPanelsByOrganization(user: USER){
    if (!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const panels = await this.prisma.candidatePanel.findMany({
      where: {
        hireRequest: {
          organization: {
            id: user.organization_id || undefined,
          },
        },
        OR: [
          {
            readable: true,
            status: "decision_pending",
          },
          { status: "interview_completed" },
          { status: "interview_scheduled" },
          { status: "created" },
        ],
      },
      select:{
        id: true,
        scheduled_date: true,
        status: true,
        panelCandidates: {
          select: {
            status: true,
            candidate: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                name: true,
                about_me: true,
                hourly_pay_rate: true,
                years_of_experience: true,
                country: true,
                specialization: true,
                employment_type: true,
                skills: {
                  select: {
                    id: true,
                    skill_name: true,
                    proficiency_level: true,
                    skill_type: true,
                  },
                },
                educations: {
                  orderBy: { year: 'desc' },
                  select: {
                    id: true,
                    degree: true,
                    institution: true,
                    year: true,
                  },
                },
                experiences: {
                  orderBy: { start_date: 'desc' },
                  select: {
                    id: true,
                    company: true,
                    position: true,
                    responsabilities: true,
                    start_date: true,
                    end_date: true,
                  },
                },
                languages: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        interviews: {
          select: {
            scheduled_date: true,
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
            assign_user_id: true,
            skills: {
              select: {
                skill_name: true,
                required_level: true
              },
            }
          },
        },
      },
    })
    
    if (!panels || panels.length === 0) throw new NotFoundException(`Panels not found for this current organization`);

    const result = panels.map(panel => ({
      ...panel,
      interview_date: panel.interviews[0]?.scheduled_date || null,
      interviews: undefined,
      panelCandidates: panel.panelCandidates.map(pc => {
        // Calculate years of experience from the earliest experience if not already set
        const validExperiences = pc.candidate.experiences.filter(exp => exp.start_date !== null);
        const earliestExperience = validExperiences.length > 0 
          ? validExperiences.sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())[0]
          : null;
        
        const calculatedYearsOfExperience = earliestExperience?.start_date
          ? new Date().getFullYear() - new Date(earliestExperience.start_date!).getFullYear()
          : 0;
        
        return {
          ...pc,
          candidate: {
            ...pc.candidate,
            // Use the stored years_of_experience or calculate from experiences
            years_of_experience: pc.candidate.years_of_experience ?? calculatedYearsOfExperience,
            employment_type: changeLabelAvailability(dbToStageDictionary[Number(pc.candidate.employment_type)]) || pc.candidate.employment_type,
          },
        };
      }),
    }));
    return result;
  }

  async scheduleInterview(id: string, data: scheduleInterviewDTO, user: USER){
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id || undefined,} : undefined
      },
      select:{
        id: true,
        hubspot_ticket_id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    const panel = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id: true,
        
    }});
    if (!panel) throw new NotFoundException(`Panel for this hire request not found`);
    const updatedDate = new Date(`${data.date_time}`);

    const interviewScheduled = await this.prisma.interview.create({
      data: {
        panel_id: panel.id,
        scheduled_date: updatedDate,
        link: data.interview_link,
        duration: 30, // default duration of 30 minutes
        
      },
    });
    if (!interviewScheduled) throw new BadRequestException(`Interview not scheduled`);

    const candidatePanelupdated = await this.prisma.candidatePanel.update({
      where:{
        id: panel.id,
      },
      data:{
        status: 'interview_scheduled',
      }
    })
    if (!candidatePanelupdated) throw new BadRequestException(`Candidate panel not updated to interview scheduled`);

    //update hire request status to 'interview_scheduled'
    const hireRequestUpdated = await this.prisma.hireRequest.update({
      where: {
        id: hireRequest.id,
      },
      data: {
        status: 'interview_scheduled',
      },
    });
    if (!hireRequestUpdated) throw new BadRequestException(`Hire request status not updated to interview scheduled`);

    try{
      const updatedDate = new Date(`${data.date_time}`);
      const updateDateTime = {
        hubspot_ticket_id: hireRequest.hubspot_ticket_id,
        pairing_date:updatedDate.toISOString().split("T")[0],
        pairing_time:updatedDate.toTimeString().split(" ")[0],
        hubspot_pipeline_stage: Object.keys(HRTicketStatus)
        .find(key => HRTicketStatus[key] === 'Candidates Interview Booked'),
      }
      await this.hubspot.updateHireRequestInHubspot(updateDateTime);

    }catch(err){
      console.error('[hubspot] updateHireRequestInHubspot failed', err?.message || err);
    }
    


    try{
      await this.notifications.notifyInterviewScheduled(hireRequest.id);
    }catch(err){
      console.error('[notifications] notifyInterviewScheduled email failed', err?.message || err);
    }
    
    return this.findOne(id, user);

  }

  async editInterview(id: string, data: scheduleInterviewDTO, user: USER){
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id || undefined,} : undefined
      },
      select:{
        id: true,
        hubspot_ticket_id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    const panel = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id: true,
        
    }});
    if (!panel) throw new NotFoundException(`Panel for this hire request not found`);

    const updatedDate = new Date(`${data.date_time}`);

    const editInterview = await this.prisma.interview.updateMany({
      where: {
        panel_id: panel.id,
      },
      data: {
        scheduled_date: updatedDate,
        link: data.interview_link,
      },
    });
    
    if (!editInterview) throw new BadRequestException(`Interview not updated`);

    try{
      const updatedDate = new Date(`${data.date_time}`);
      const updateDateTime = {
        hubspot_ticket_id: hireRequest.hubspot_ticket_id,
        pairing_date:updatedDate.toISOString().split("T")[0],
        pairing_time:updatedDate.toTimeString().split(" ")[0],
      }
      await this.hubspot.updateHireRequestInHubspot(updateDateTime);
    }catch(err){
      console.error('[hubspot] updateHireRequestInHubspot failed', err?.message || err);
    }

    try{
      await this.notifications.notifyInterviewScheduled(hireRequest.id);
    }catch(err){
      console.error('[notifications] notifyInterviewScheduled email failed', err?.message || err);
    }

    return this.findOne(id, user);

  }

  async awaitingDecision(id: string, data: awaitingDecisionDTO, user: USER): Promise<boolean> {
    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id || undefined,} : undefined
      },
      select:{
        id: true,
        hubspot_ticket_id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    //check if panel exists
    const panelExists = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id: true,
        panelCandidates: {
          select: {
            candidate: {
              select: {
                id: true,
                hubspot_id: true,
                pipeline_status: true,
                pipeline_status_origin: true
              },
            },
          },
        },
      }
    });
    if( !panelExists) throw new NotFoundException(`Panel for this hire request not found`);
   

    const updatedDate = new Date(`${data.date_time}`);

    const hireRequestUpdated = await this.prisma.candidatePanel.update({
      where: {
        id: panelExists.id,
      },
      data: {
        status: 'decision_pending',
        scheduled_date: updatedDate,
      },
    });
    if (!hireRequestUpdated) throw new BadRequestException(`Panel not updated to decision_pending`);

    //update hire request status to 'awaiting_decision'
    const candidates = panelExists.panelCandidates.map(pc => pc.candidate);
    const hireRequestStatusUpdated = await this.prisma.hireRequest.update({
      where: {
        id: hireRequest.id,
      },
      data: {
        status: 'awaiting_decision',
      },
    });
    if (!hireRequestStatusUpdated) throw new BadRequestException(`Hire request status not updated to awaiting decision`);


    //Business logical changed on 2025-11-03 asked by Hanieh and did by Paulo
    const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Endorsed via Platform';
    })
    if (!pipelineStatus) throw new BadRequestException(`Pipeline status mapping not found`);

    //update candidate as 'blocked' on Panel
    const panelCandidatesUpdated = await this.prisma.panelCandidate.updateMany({
      where: {
        panel_id: panelExists.id,
      },
      data: {
        status: 'blocked',
      },
    });

    const hubspotUpdated = await this.hubspot.updateManyCandidatesFromHireRequest(
      candidates,
      pipelineStatus
    );

    try {  
      const dataForHubspot = {
        hubspot_ticket_id: hireRequest.hubspot_ticket_id,
        hubspot_pipeline_stage: Object.keys(HRTicketStatus)
        .find(key => HRTicketStatus[key] === 'Interview Done (For Follow-up)'),
      }
      const hrTicket = await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
    } catch (err) {
      console.warn('[hubspot] updateHireRequestInHubspot in Awaiting decision failed', err?.message || err);
    }

    // Fire awaiting decision notification to organization admins (non-blocking)
    try {
      await this.notifications.notifyHireRequestAwaitingDecision(hireRequest.id);
    } catch (err) {
      console.warn('[notifications] awaiting-decision email failed', err?.message || err);
    }

    return this.findOne(id, user);
  }

  async allowMoreTime(id: string, data: awaitingDecisionDTO, user: USER): Promise<boolean>{

    if(!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id || undefined} : undefined
      },
      select:{
        id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    //check if panel exists
    const panelExists = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id: true,
      }
    });
    if( !panelExists) throw new NotFoundException(`Panel for this hire request not found`);

    const updatedDate = new Date(`${data.date_time}`);

    const panelUpdated = await this.prisma.candidatePanel.update({
      where: {
        id: panelExists.id,
      },
      data: {
        scheduled_date: updatedDate,
      },
    });
    if (!panelUpdated) throw new BadRequestException(`Panel not updated to allow more time`);

    return this.findOne(id, user);
  }

  async changeWinner(id: string, data: changeWinnerDTO, user: USER): Promise<any> {
    if (!user || user.role.includes("organization") && !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Endorsed via Platform';
    })
    if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Hired`);
    

    const pipelineStatusLosers = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Available Candidates';
    })
    if (!pipelineStatusLosers) throw new NotFoundException(`Pipeline status not found for Available Candidates`);
    

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id || undefined} : undefined
      },
      select:{
        id: true,
        hubspot_ticket_id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    //check if panel exists
    const panelExists = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id: true,
      }
    });
    if( !panelExists) throw new NotFoundException(`Panel for this hire request not found`);

    //check if winner exists inside the panel
    const winnerExists = await this.prisma.panelCandidate.findMany({
      where: {
        panel_id: panelExists.id,
        candidate_id: {in : data.winner_id},
      },
      select: {
        id: true,
        candidate_id: true,
        candidate:{
          select:{
            hubspot_id: true,
          }
        }
      },
    });
    if(!winnerExists) throw new NotFoundException(`Winner candidate not found in the panel`);

    const loserExists = await this.prisma.panelCandidate.findMany({
      where: {
        panel_id: panelExists.id,
        NOT: {
          candidate_id: { in: data.winner_id},
        },
      },
      select: {
        id: true,
        candidate:{
          select: {
            id: true,
            hubspot_id: true,
            pipeline_status_origin: true
          },
        },
      },
    });
    //removed asked by Pauli because right now we can have just one candidate in the panel
    //if(!loserExists || loserExists.length === 0) throw new NotFoundException(`No other candidates found in the panel`);

    //change Panel status
    const panelUpdated = await this.prisma.candidatePanel.update({
      where: {
        id: panelExists.id,
      },
      data: {
        status: 'decision_made',
      },
    });
    if( !panelUpdated) throw new BadRequestException(`Panel not updated to decision made`);

    //change status of hire request to 'placement_completed'
    const hireRequestUpdated = await this.prisma.hireRequest.update({
      where: {
        id: hireRequest.id,
      },
      data: {
        status: 'placement_completed',
      },
    });
    if( !hireRequestUpdated) throw new BadRequestException(`Hire request not updated to placement completed`);

    //update the winner candidate as selected_by_client
    const winner = await this.prisma.panelCandidate.updateMany({
      where: {
        panel_id: panelExists.id,
        candidate_id: { in : data.winner_id}
      },
      data: {
        status: 'selected_by_client',
      },
    });
    if (!winner) throw new BadRequestException(`Panel not updated to reset winners`);

    //update all other candidates as not_selected
    const others = await this.prisma.panelCandidate.updateMany({
      where: {
        panel_id: panelExists.id,
        NOT: {
          candidate_id: { in : data.winner_id}
        }
      },
      data: {
        status: 'returned_to_pool',
      },
    });
    if( !others) throw new BadRequestException(`Panel not updated to set other candidates as not selected`);
    
    if (loserExists){
      const candidateLosers = loserExists.map(c => c.candidate);
      //update losers to 'available candidates' on database
      await Promise.all(
        candidateLosers.map(async c =>{
          const  pipeline_treated = c.pipeline_status_origin || pipelineStatusLosers;
          await this.prisma.candidate.update({
            where: { id: c.id },
            data: { pipeline_status: pipeline_treated},
          });
          await this.hubspot.updateOneCandidateFromHireRequest(c.hubspot_id, pipeline_treated);
        }
        )
      );
    }

    if (winnerExists){
      await Promise.all(
        winnerExists.map(async c =>{
          await this.prisma.candidate.update({
            where: { id: c.candidate_id },
            data: { pipeline_status: pipelineStatus},
          });
          await this.hubspot.updateOneCandidateFromHireRequest(c.candidate.hubspot_id, pipelineStatus);
        }
        )
      );
    }
    
    //removed by requested Pauli: https://regenta-company.monday.com/boards/9328303960/pulses/18069150933?notification=6971532371
    //change the Candidate pipeline status to 'Hired' and send it for the hubspot
    /*const candidateUpdated = await this.prisma.candidate.update({
      where: {
        id: data.winner_id,
      },
      data: {
        pipeline_status: pipelineStatus,
      },
    });
    if (!candidateUpdated) throw new BadRequestException(`Candidate not updated to endorsed`);
    

    
    try{
      //communication with hubspot to update status hired can be added here
      await this.hubspot.updateOneCandidateFromHireRequest(candidateUpdated.hubspot_id, pipelineStatus);
    
    }catch (error) {
      console.error('Error updating candidate in HubSpot:', error);
      throw new BadRequestException(`Error updating candidate in HubSpot`);
    }
    */

    const dataForHubspot = {
      hubspot_ticket_id: hireRequest.hubspot_ticket_id,
      hubspot_pipeline_stage: Object.keys(HRTicketStatus)
      .find(key => HRTicketStatus[key] === 'For Onboarding (Paired)'),
    }
    await this.hubspot.updateHireRequestInHubspot(dataForHubspot); 
    
    // Fire placement completed notification (non-blocking)
    try {
      await this.notifications.notifyHireRequestPlacementCompleted(hireRequest.id); //without second parameter to get all winner candidates
    } catch (err) {
      console.warn('[notifications] placement-completed email failed', err?.message || err);
    }

    // =========== return object requested by Lucas

    const panels = await this.prisma.candidatePanel.findMany({
      where: {
        id: panelExists.id,
      },
      select:{
        id: true,
        scheduled_date: true,
        status: true,
        panelCandidates: {
          select: {
            status: true,
            candidate: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                name: true,
                hourly_pay_rate: true,
                country: true,
                avatar_url: true,
                experiences: {
                  orderBy: { start_date: 'asc' },
                  take: 1, 
                  select: { start_date: true },
                },
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
            assign_user_id: true,
            skills: {
              select: {
                skill_name: true,
                required_level: true
              },
            }
          },
        },
      },
    })
    
    if (!panels || panels.length === 0) throw new NotFoundException(`Panels not found for this current organization`);

    const result = panels.map(panel => ({
      ...panel,
      panelCandidates: panel.panelCandidates.map(pc => {
        const startDate = pc.candidate.experiences[0]?.start_date;
        const years_of_experience = startDate
          ? new Date().getFullYear() - new Date(startDate).getFullYear()
          : 0;
        return {
          ...pc,
          candidate: {
            ...pc.candidate,
            years_of_experience,
            salary: findMonthlySalary(pc.candidate.hourly_pay_rate?.toNumber() || 0),
            avatar: pc.candidate.avatar_url ? `${process.env.AVATAR_URL}${pc.candidate.avatar_url}` :  null,
          },
        };
      }),
    }));

    return result;
    
  }

  async showMatchHireRequests(candidateId: string): Promise<any> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { 
        skills: true,
        panelCandidates: true
       },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
  
    const candidateSkills = candidate.skills.map(s => s.skill_name);
  
    const hireRequests = await this.prisma.hireRequest.findMany({
      where: { status: 'sourcing' },
      include: {
        skills: true,
        panels: {
          include: {
            panelCandidates: true,
          },
        },
      },
    });
  
    const validHireRequests = hireRequests.filter(hr => 
      hr.panels.every(panel => panel.panelCandidates.length < 5)
    );
  
    const scoredHireRequests = validHireRequests.map(hr => {
      let score = 0;
  
      if (hr.specialization && candidate.specialization === hr.specialization) score += 1;
  
      if (hr.location && candidate.country === hr.location) score += 1;
  
      if (hr.availability && candidate.employment_type === hr.availability) score += 1;
  
      const hourly_from = hr.salary_range_from
        ? findHourlySalary(Number(hr.salary_range_from))
        : undefined;
      const hourly_to = hr.salary_range_to
        ? findHourlySalary(Number(hr.salary_range_to))
        : undefined;
  
      if (
        candidate.hourly_pay_rate !== null &&
        hourly_from !== undefined &&
        hourly_to !== undefined &&
        candidate.hourly_pay_rate.toNumber() >= hourly_from &&
        candidate.hourly_pay_rate.toNumber() <= hourly_to
      ) score += 1;
  
      const requiredSkills = hr.skills.map(s => s.skill_name);
      const matchedSkills = candidateSkills.filter(skill => requiredSkills.includes(skill));
      score += matchedSkills.length;
  
      return {
        ...hr,
        matchedSkills,
        score,
      };
    });

    scoredHireRequests.sort((a, b) => b.score - a.score);
    return scoredHireRequests ;
  }

  async getAvailableCandidatesForSelection(hireRequestId: string, user: USER): Promise<any> {
    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        org_id: true,
        assign_user_id: true,
      },
    });

    if (!hireRequest) {
      throw new NotFoundException('Hire request not found');
    }

    if (user.role.includes('organization')) {
      if (!user.organization_id || user.organization_id !== hireRequest.org_id) {
        throw new NotFoundException('Hire request not found');
      }
    } else if (user.role.includes('system')) {
    } else {
      throw new NotFoundException('Hire request not found');
    }

    const panel = await this.prisma.candidatePanel.findFirst({
      where: { hire_request_id: hireRequestId },
      include: {
        panelCandidates: {
          include: {
            candidate: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                name: true,
                email: true,
                specialization: true,
                employment_type: true,
                country: true,
                about_me: true,
                pipeline_status: true,
                hourly_pay_rate: true,
                years_of_experience: true,
                avatar_url: true,
                languages: {
                  select: { name: true },
                },
                skills: {
                  select: { skill_name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!panel) {
      throw new NotFoundException('Panel for this hire request not found');
    }

    const panelCandidates = panel.panelCandidates;

    //Here I cant filter this because this specific candidate got 'Endorsed via platform' when they were added to the panel
    //const availableCandidates = panelCandidates.filter(pc => 
    //  pc.candidate.pipeline_status === '261075105' || pc.candidate.pipeline_status === '1087596819'
    //);
    const availableCandidates = (
      await Promise.all(
        panelCandidates.map(async (pc) => {
          const existInOtherPanel = await this.prisma.panelCandidate.findFirst({
            where: {
              candidate_id: pc.candidate.id,
              panel_id: { not: pc.panel_id },
              status: {
                in: ['selected_by_client', 'blocked'],
              }, //Dont allow get candidates already selected in other panels
            },
          });
    
          return existInOtherPanel ? null : pc;
        })
      )
    ).filter((pc) => pc !== null);


    const selectedCandidate = panelCandidates.find(pc => pc.status === 'selected_by_client');

    if (availableCandidates.length === 1 && selectedCandidate && 
        availableCandidates[0].candidate.id === selectedCandidate.candidate_id) {
      return [];
    }

    

    const mappedCandidates = availableCandidates.map(pc => ({
      ...pc.candidate,
      panelStatus: pc.status,
      panelId: panel.id,
      panelScheduledDate: panel.scheduled_date,
      isCurrentSelection: selectedCandidate ? pc.candidate.id === selectedCandidate.candidate_id : false,
      salary: pc.candidate.hourly_pay_rate ? findMonthlySalary(pc.candidate.hourly_pay_rate.toNumber()) : null,
      avatar: pc.candidate.avatar_url ? `${process.env.AVATAR_URL}${pc.candidate.avatar_url}` :  null,
      employment_type: changeLabelAvailability(dbToStageDictionary[Number(pc.candidate.employment_type)]) || pc.candidate.employment_type,
    }));

    return mappedCandidates;
  }

  async getVATypes () : Promise<any> {
    try {
      const url = "https://api.hubapi.com/crm/v3/properties/tickets";
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      });
  
      const vaTypeProperty = response.data.results.find(
        (prop) => prop.name === "va_type"
      );
  
      if (!vaTypeProperty) {
        return [];
      }

      return vaTypeProperty.options || [];
    } catch (error) {
      console.error("Failed to find types:", error.response?.data || error.message);
      throw new Error("Failed to find VA types");
    }
  };
}
