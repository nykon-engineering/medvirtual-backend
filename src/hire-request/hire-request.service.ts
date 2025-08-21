import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HireRequestStatus, USER } from '@prisma/client';

import { hireRequestDictionary } from '../common/dictionaries/hire-request-dictionary';
import { PrismaService } from '../prisma/prisma.service';

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
import axios from 'axios';

@Injectable()
export class HireRequestService {

  constructor(
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateHireRequestDto, user: USER):Promise<string> {  
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const {skills, client_id, ...hireRequestData} = data;

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
      }
    });
    if (!organizationSQL) throw new NotFoundException(`Organization from client not found`);

    const hireRequest = {
      ...hireRequestData,
      organization: user.role.includes('organization') ?  {connect: {id: user.organization_id}} : { connect : { id: client_id } },
      status: organizationSQL.status !== 'active' ? 'pending_signature' as HireRequestStatus : 'new' as HireRequestStatus,
    };

    const newHireRequest = await this.prisma.hireRequest.create({
      data: hireRequest,
    })
    if (!newHireRequest) throw new BadRequestException(`Hire request not created`);
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

    return 'Hire request created successfully';
  }

  async findAll(user: USER): Promise<object[]> {
    
    if (!user || !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }
    if(!user.role) throw new NotFoundException('User role not found');

    const hireRequests = await this.prisma.hireRequest.findMany({
      where: user.role.includes('organization') ?  { organization: { id: user.organization_id } }: undefined,
      include: {
        skills: true,
        organization: true,
        panels: true,
      }
    })
    if(!hireRequests) throw new NotFoundException('No hire requests found');

    return hireRequests;
  }

  async findOne(id: string, user: USER): Promise<any> {
    if (!user || !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: { id : user.organization_id,}
      },
      include: {
        skills: true,
        organization: true,
      },
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    return hireRequest;
  }

  async update(id: string, data: UpdateHireRequestDto, user: USER): Promise<object> {
    let result;
    if(!user || !user.organization_id) {
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

    if( skills && skills.length > 0) {
      await this.prisma.hireRequestSkill.deleteMany({
        where: {
          hire_request_id: id,
        },
      });

      const skillsUpdated = await this.prisma.hireRequestSkill.createMany({
        data: skills.map(skill => ({
          skill_name: skill.name,
          required_level: skill.level,
          hire_request_id: id,
        })),
      });
      if (!skillsUpdated) throw new BadRequestException(`Hire request skills not updated`);
      result.skills = skillsUpdated;
    }
    return result;
  }

  async remove(id: string, user: USER): Promise<boolean> {
    if (!user || !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id} : undefined,
      },
    });

    if (!hireRequest)  throw new NotFoundException(`Hire request not found`);
    const statusKey = Object.keys(hireRequestDictionary).find(key => {
      return hireRequestDictionary[key] === hireRequest.status;
    })
    if( !statusKey) throw new NotFoundException(`Status not found for hire request`);
    if(Number(statusKey) > 2) {
      throw new BadRequestException(`Hire request with status ${hireRequest.status.replace("_"," ").toUpperCase()} cannot be deleted`);
    }

    const requestdeleted = await this.prisma.hireRequest.delete({
      where: {
        id: hireRequest.id,
      }
    });
    if (!requestdeleted) throw new BadRequestException(`Hire request not deleted`);

    return true;
  }

  async updateStatus(id: string, data: changeStatusHireRequesDTO, user: USER): Promise<boolean> {
    if (!user || !user.organization_id) {
      throw new NotFoundException('User not found or not part of an organization');
    }
    if (!data || !data.status) throw new BadRequestException('Data for status change is required');
    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id
      },
      select:{
        status: true,
      }
    });

    if (!hireRequest) {
      throw new NotFoundException(`Hire request not found`);
    }

    //verify rules for changes
    const currentKey = Object.keys(hireRequestDictionary).find(key => {
      return hireRequestDictionary[key] === hireRequest.status;
    })
    const newKey = Object.keys(hireRequestDictionary).find(key => {
      return hireRequestDictionary[key] === data.status;
    })

    if (data.status === 'cancelled'){

      const candidates = await this.prisma.panelCandidate.findMany({
        where: {
          panel: {
            hire_request_id: id,
          },
        },
        select: {
          candidate: {
            select: {
              id: true,
              hubspot_id: true,
            }
          }
        },
      })

      const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
        return dbToStageDictionary[key] === 'Available Candidates';
      })
      if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Available Candidates`);
      //update candidates pipeline status to 'Available Candidates'
      //comunicate with hubspot to update status
      

      //update all candidates for the hire request to 'returned_to_pool'
      const candidatesUpdated = await this.prisma.panelCandidate.updateMany({
        where: {
          panel: {
            hire_request_id: id,
          },
        },
        data: {
          status: 'returned_to_pool',
        },
      });
    }

    
    if ( 
      Number(newKey)+1 === Number(currentKey) ||
      Number(newKey)-1 === Number(currentKey) || 
      hireRequest.status == 'cancelled' && data.status === 'new' ||
      hireRequest.status == 'placement_completed' && data.status === 'new' ||
      hireRequest.status == 'cancelled' && data.status === 'sourcing' ||
      hireRequest.status == 'awaiting_decision' && data.status === 'panel_ready' ||
      hireRequest.status == 'panel_ready' && data.status === 'placement_completed' ||
      hireRequest.status == 'interview_scheduled' && data.status === 'placement_completed' ||
      data.status === 'cancelled'
    ) { 
      const updatedRequest = await this.prisma.hireRequest.update({
        where: {
          id: id,
        },
        data: {
          status: data.status as HireRequestStatus,
        },
      });
  
      if (!updatedRequest) throw new BadRequestException(`Hire request status not updated`);
      return true;
    }else{
      throw new BadRequestException(`Status change from ${hireRequest.status.replace("_"," ").toUpperCase()} to ${data.status.replace("_"," ").toUpperCase()} is not allowed`);
    }
  }

  async reassign(id: string, user: USER, data: reassignDTO): Promise<boolean> {
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.updateMany({
      where: {
        id: id
      },
      data:{
        assign_user_id: data.user_id,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);


    return true;
  }

  async showMatchCandidates(id: string, user: USER): Promise <object>{
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id
      },
      select:{
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
        }
      }
    });
    if (!hireRequest)  throw new NotFoundException(`Hire request not found`);
    const requiredSkills = hireRequest.skills.map(s => s.skill_name);

    const hourly_from = hireRequest.salary_range_from ? Number(hireRequest.salary_range_from) / (Number(process.env.CANDIDATE_HOUR_PER_MONTH) * Number(process.env.CANDIDATE_PERCENT)) : undefined;
    const hourly_to = hireRequest.salary_range_to ? Number(hireRequest.salary_range_to) / (Number(process.env.CANDIDATE_HOUR_PER_MONTH) * Number(process.env.CANDIDATE_PERCENT)) : undefined;

    //at least 1 skill match
    const candidates = await this.prisma.candidate.findMany({
      where: {
        specialization: hireRequest.specialization ? 
          { 
            contains: hireRequest.specialization, 
            mode: 'insensitive' 
          }
        : undefined,
        country: hireRequest.location ?  hireRequest.location  : undefined,
        employment_type: hireRequest.availability ? hireRequest.availability : undefined,
        hourly_pay_rate:{
          gte: hourly_from,
          lte: hourly_to,
        },
        skills: {
          some: {
            skill_name: { in: requiredSkills },
          },
        },
      },
      include: {
        skills: true,
        experiences: true,
        educations: true,
      },
    });

    //score candidates based on skill matches
    const scoredCandidates = candidates.map(candidate => {
      const candidateSkills = candidate.skills.map(s => s.skill_name);
      const matchedSkills = candidateSkills.filter(skill => requiredSkills.includes(skill));
      const score = matchedSkills.length;
  
      return {
        ...candidate,
        matchedSkills,
        score,
      };
    });

    //sort for score
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates;
  }
  
  async confirmPanel(data: ConfirmPanelHireRequestDto, user:USER) : Promise<boolean> {
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
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
      return dbToStageDictionary[key] === 'Endorsed to Client';
    })
    //update candidates with pipelinestatus = 'Endorsed to Client'
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

    //communication with hubspot to update status can be added here
    const body = {
      properties: {
        hs_pipeline_stage: pipelineStatus
      }
    };
    await Promise.all(
      candidates.map((candidate) =>
        axios.patch(
          `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${candidate.hubspot_id}`,
          body,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        )
      )
    );

    return true;
  }

  async editPanel(data: ConfirmPanelHireRequestDto, user: USER) : Promise<boolean> {
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.candidates_id) throw new BadRequestException('Data is required to confirm panel');
    if (data.candidates_id.length < 3) throw new BadRequestException('You need to chosse at least 3 candidates');

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

    //remove old panel
    const removeCandidates = await this.prisma.panelCandidate.deleteMany({
      where: {
        panel_id: panelExists.id,
      },
    });
    if (!removeCandidates) throw new BadRequestException(`Panel candidates not removed`);

    //add each candidate to the panel
    const addCandidates = await this.prisma.panelCandidate.createMany({
      data: data.candidates_id.map(candidateId => ({
        candidate_id: candidateId,
        panel_id: panelExists.id,
      })),
    })
    if (!addCandidates) throw new BadRequestException(`Panel candidates not added`);

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
      return dbToStageDictionary[key] === 'Endorsed to Client';
    })
    //update candidates with pipelinestatus = 'Endorsed to Client'
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

    //communication with hubspot to update status can be added here
    const body = {
      properties: {
        hs_pipeline_stage: pipelineStatus
      }
    };
    await Promise.all(
      candidates.map((candidate) =>
        axios.patch(
          `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${candidate.hubspot_id}`,
          body,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        )
      )
    );



    return true;
  }

  async panelReady(data: panelReadyDTO, user: USER): Promise<boolean>{
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.hireRequest_id) throw new BadRequestException('Data is required to confirm panel ready');
    //update hire request with status = 'panel_ready'
    const hireRequest = await this.prisma.hireRequest.update({
      where: {
        id: data.hireRequest_id,
      },
      data: {
        status: 'panel_ready',
      },
    });
    if (!hireRequest) throw new BadRequestException(`Hire request not updated to panel ready`);

    //update panel with readable = true
    const panelUpdated = await this.prisma.candidatePanel.updateMany({
      where: {
        hire_request_id: data.hireRequest_id,
      },
      data: {
        readable: data.readable,
      },
    });
    if (!panelUpdated) throw new BadRequestException(`Panel not updated to readable`);

    //check if panelCandidate there are ate least 3 
    const panelCandidates = await this.prisma.panelCandidate.findMany({
      where: {
        panel_id: data.hireRequest_id,
      },
    });
    if (!panelCandidates || panelCandidates.length < 3) {
      throw new BadRequestException(`Panel must have at least 3 candidates`);
    }

    return true;
  }

  async getPanel(id: string, user: USER): Promise<returnGetPanelDto> {
    let result: any = {};
    if(!id) throw new BadRequestException('Hire request ID is required');
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        org_id: user.role.includes('organization') ?  user.organization_id : undefined,
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

  async getPanelsByOrganization(user: USER){
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    
    const panels = await this.prisma.candidatePanel.findMany({
      where: {
        readable: true,
        hireRequest: {
          organization: {
            id: user.organization_id,
          },
        },
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
          },
        };
      }),
    }));
    return result;
  }

  async scheduleInterview(id: string, data: scheduleInterviewDTO, user: USER){
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id,} : undefined
      },
      select:{
        id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    const panel = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id: true,
      }
    });
    if (!panel) throw new NotFoundException(`Panel for this hire request not found`);
    const updatedDate = new Date(`${data.date}T${data.time}:00.000Z`);

    const interviewScheduled = await this.prisma.interview.create({
      data: {
        panel_id: panel.id,
        scheduled_date: updatedDate,
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
    return true;

  }

  async awaitingDecision(id: string, data: awaitingDecisionDTO, user: USER): Promise<boolean> {
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id,} : undefined
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

    const updatedDate = new Date(`${data.date}T${data.time}:00.000Z`);

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
    const hireRequestStatusUpdated = await this.prisma.hireRequest.update({
      where: {
        id: hireRequest.id,
      },
      data: {
        status: 'awaiting_decision',
      },
    });
    if (!hireRequestStatusUpdated) throw new BadRequestException(`Hire request status not updated to awaiting decision`);

    return true;
  }

  async allowMoreTime(id: string, data: awaitingDecisionDTO, user: USER): Promise<boolean>{

    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id,} : undefined
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

    const updatedDate = new Date(`${data.date}T${data.time}:00.000Z`);

    const panelUpdated = await this.prisma.candidatePanel.update({
      where: {
        id: panelExists.id,
      },
      data: {
        scheduled_date: updatedDate,
      },
    });
    if (!panelUpdated) throw new BadRequestException(`Panel not updated to allow more time`);

    return true;
  }

  async changeWinner(id: string, data: changeWinnerDTO, user: USER): Promise<boolean> {
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Hired';
    })
    const pipelineStatusLosers = Object.keys(dbToStageDictionary).find(key => {
      return dbToStageDictionary[key] === 'Available Candidates';
    })
    if (!pipelineStatusLosers) throw new NotFoundException(`Pipeline status not found for Available Candidates`);
    if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Hired`);

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: user.role.includes('organization') ? { id : user.organization_id,} : undefined
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

    //check if winner exists inside the panel
    const winnerExists = await this.prisma.panelCandidate.findFirst({
      where: {
        panel_id: panelExists.id,
        candidate_id: data.winner_id,
      },
      select: {
        id: true,
      },
    });
    if(!winnerExists) throw new NotFoundException(`Winner candidate not found in the panel`);

    const loserExists = await this.prisma.panelCandidate.findMany({
      where: {
        panel_id: panelExists.id,
        NOT: {
          candidate_id: data.winner_id,
        },
      },
      select: {
        id: true,
        candidate:{
          select: {
            id: true,
            hubspot_id: true,
          },
        },
      },
    });
    if(!loserExists || loserExists.length === 0) throw new NotFoundException(`No other candidates found in the panel`);

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
        candidate_id: data.winner_id
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
          candidate_id: data.winner_id
        }
      },
      data: {
        status: 'returned_to_pool',
      },
    });
    if( !others) throw new BadRequestException(`Panel not updated to set other candidates as not selected`);
    //comunicate with hubspot to update status
    /*
    const bodyLosser = {
      properties: {
        hs_pipeline_stage: pipelineStatusLosers
      }
    };
    await Promise.all(
      loserExists.map((loser) =>
        axios.patch(
          `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${loser.candidate.hubspot_id}`,
          bodyLosser,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        )
      )
    );
    */

    
    //change the Candidate pipeline status to 'Hired' and send it for the hubspot
    const candidateUpdated = await this.prisma.candidate.update({
      where: {
        id: data.winner_id,
      },
      data: {
        pipeline_status: pipelineStatus,
      },
    });
    if (!candidateUpdated) throw new BadRequestException(`Candidate not updated to endorsed`);

    //communication with hubspot to update status ired can be added here
    const bodyWinner = {
      properties: {
        hs_pipeline_stage: pipelineStatus
      }
    };
    const response = await axios.patch(`https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${candidateUpdated.hubspot_id}`,
      bodyWinner,
      {
          headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
          }
      }
  )

    return true;
  }
}
