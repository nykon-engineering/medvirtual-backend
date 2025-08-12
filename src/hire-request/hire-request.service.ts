import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';
import { PrismaService } from '../prisma/prisma.service';
import { USER } from '@prisma/client';

@Injectable()
export class HireRequestService {

  constructor(
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateHireRequestDto, user: USER):Promise<string> {

    if(!user || !user.organization_id) throw new NotFoundException('User not found or not part of an organization');

    const {skills, ...hireRequestData} = data;
    if(user.role === 'prospect') hireRequestData.status = 'pending_signature';
    const hireRequest = {
      ...hireRequestData,
      organization: {connect: {id: user.organization_id}},
    };

    const newHireRequest = await this.prisma.hireRequest.create({
      data: hireRequest,
    })

    if (skills && skills.length > 0) {

      await this.prisma.hireRequestSkill.createMany({
        data: skills.map(skill => ({
          skill_name: skill.name,
          required_level: skill.level,
          hire_request_id: newHireRequest.id,
        })),
      });
      
    }
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

    const hireRequest = this.prisma.hireRequest.findUnique({
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
      throw new NotFoundException(`Hire request with ID ${id} not found`);
    }

    return hireRequest;
  }

  update(id: number, updateHireRequestDto: UpdateHireRequestDto) {
    return `This action updates a #${id} hireRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} hireRequest`;
  }
}
