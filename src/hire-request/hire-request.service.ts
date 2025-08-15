import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, USER } from '@prisma/client';
import { changeStatusHireRequesDTO } from './dto/changeStatus-hire-request.dto';
import { hireRequestDictionary } from '../common/dictionaries/hire-request-dictionary';
import { reassignDTO } from './dto/reassign-hire-request.dto';
import { connect } from 'net';

@Injectable()
export class HireRequestService {

  constructor(
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateHireRequestDto, user: USER):Promise<string> {

    
      if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

      const {skills, ...hireRequestData} = data;

      const hireRequest = {
        ...hireRequestData,
        organization: user.role.includes('organization') ?  {connect: {id: user.organization_id}} : { connect : { id: data.client_id } },
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
      where: {
        organization: user.role.includes('organization') ? { id: user.organization_id } : undefined,
      },
      include: {
        skills: true,
        organization: true,
      },
    })
    if(!hireRequests) throw new NotFoundException('No hire requests found for this organization');

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
  
  async confirmPanel(data, user){

  }

}
