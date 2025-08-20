import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, USER } from '@prisma/client';
import { changeStatusHireRequesDTO } from './dto/changeStatus-hire-request.dto';
import { hireRequestDictionary } from '../common/dictionaries/hire-request-dictionary';
import { reassignDTO } from './dto/reassign-hire-request.dto';
import { ConfirmPanelHireRequestDto } from './dto/confirm-panel-hire-request.dto';
import { panelReadyDTO } from './dto/panelReady-hire-request.dto';
import { returnGetPanelDto } from './dto/return-getPanel.dto';
import { scheduleInterviewDTO } from './dto/schedule-interview.dto';
import { awaitingDecisionDTO } from './dto/awaiting-decision.dto';
import { changeWinnerDTO } from './dto/change-winner.dto';

@Injectable()
export class HireRequestService {

  constructor(
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateHireRequestDto, user: USER):Promise<string> {  
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const {skills, client_id, ...hireRequestData} = data;

    if( user.role.includes('system') && !client_id) throw new BadRequestException('Client ID is required for system users');

    const hireRequest = {
      ...hireRequestData,
      organization: user.role.includes('organization') ?  {connect: {id: user.organization_id}} : { connect : { id: client_id } },
      status: user.status==='prospect' ? 'pending_signature' as HireRequestStatus : 'new' as HireRequestStatus,
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
        user_id: undefined, // default user because all panel start as unassigned
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
      },
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

    if (!hireRequest) {
      throw new NotFoundException(`Hire request not found`);
    }

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
        id: id,
        organization: { id : user.organization_id,}
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
        organization: { id : user.organization_id,}
      },
    });

    if (!hireRequest) {
      throw new NotFoundException(`Hire request not found`);
    }

    const requestdeleted = await this.prisma.hireRequest.delete({
      where: {
        id: id,
      },
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
        id: id,
        organization: { id : user.organization_id,}
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


    /*
      next or previus stages;
    */
    if ( 
      Number(newKey)+1 === Number(currentKey) ||
      Number(newKey)-1 === Number(currentKey) || 
      hireRequest.status == 'cancelled' && data.status === 'new' ||
      hireRequest.status == 'placement_completed' && data.status === 'new' ||
      hireRequest.status == 'cancelled' && data.status === 'sourcing' ||
      hireRequest.status == 'awaiting_decision' && data.status === 'panel_ready' ||
      hireRequest.status == 'panel_ready' && data.status === 'placement_completed' ||
      hireRequest.status == 'interview_scheduled' && data.status === 'placement_completed'
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
      throw new BadRequestException(`Status change from ${hireRequest.status} to ${data.status} is not allowed`);
    }
  }

  async reassign(id: string, user: USER, data: reassignDTO): Promise<boolean> {
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.user_id) throw new BadRequestException('User ID is required for reassignment');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: { id : user.organization_id,}
      },
      select:{
        id: true,
      }
    });
    if (!hireRequest) {
      throw new NotFoundException(`Hire request not found`);
    }

    const panelExists = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },select:{
        id: true,
      }
    });
    if (!panelExists) throw new NotFoundException(`Panel for this hire request not found`);

    const panelUpdated = await this.prisma.candidatePanel.updateMany({
      where: {
        id: panelExists.id,
      },
      data: {
        user_id: data.user_id,
      },
    });
    if (!panelUpdated) throw new BadRequestException(`Hire request not reassigned`);

    return true;
  }

  async showMatchCandidates(id: string, user: USER): Promise <object>{
    if (!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const hireRequest = await this.prisma.hireRequest.findUnique({
      where: {
        id: id,
        organization: { id : user.organization_id,}
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
    if (data.candidates_id.length !== 5) throw new BadRequestException('Exactly 5 candidates must be selected to confirm panel');

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

    return true;
  }

  async editPanel(data: ConfirmPanelHireRequestDto, user: USER) : Promise<boolean> {
    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');
    if (!data || !data.candidates_id) throw new BadRequestException('Data is required to confirm panel');
    if (data.candidates_id.length !== 5) throw new BadRequestException('Exactly 5 candidates must be selected to confirm panel');

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
      },
      select: {
        id: true,
      }
    });
    if (!hireRequest) throw new NotFoundException(`Hire request not found`);

    const panel = await this.prisma.candidatePanel.findFirst({
      where: {
        hire_request_id: hireRequest.id,
      },
      select:{
        id : true,
      }
    });
    if (!panel) throw new NotFoundException(`Panel for this hire request not found`);
    result.hireRequestId = id;
    result.panelId = panel.id;

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
        id: data.winner_id
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
          id: data.winner_id
        }
      },
      data: {
        status: 'returned_to_pool',
      },
    });
    if( !others) throw new BadRequestException(`Panel not updated to set other candidates as not selected`);

    return true;
  }
}
