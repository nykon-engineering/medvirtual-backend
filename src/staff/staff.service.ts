import { BadRequestException, Injectable } from '@nestjs/common';
import { USER } from '@prisma/client';
import { CreateStaffDto } from './dto/create-staff.dto';

import { PrismaService } from '../prisma/prisma.service';
import { title } from 'process';


@Injectable()
export class StaffService {

  constructor(
    private readonly prisma: PrismaService
  ) {}

  private async findOne(id: string) {
    return await this.prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        hirerequest_id: true,
        status: true,
        salary: true,
        start_date: true,
        created_at: true,
        updated_at: true,
        candidate:{
          select:{
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            specialization: true,
            employment_type: true,
            country: true,
            about_me: true,
            languages: {
              select: {
                name: true,
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
            pay_rate: true,
            description: true,
            created_at: true,
            created_by: true,
          }
        }
      }
    });
  }

  async create(createStaffDto: CreateStaffDto, user: USER) {
    try{
      const staff = await this.prisma.staff.create({
        data: {
          candidate_id: createStaffDto.candidate_id,
          hirerequest_id: createStaffDto.hirerequest_id,
          status: createStaffDto.status,
          salary: createStaffDto.salary,
          start_date: createStaffDto.start_date,
          created_by: user.id,
        }
      })
      
      return await this.findOne(staff.id);

    }catch(error){
      throw new BadRequestException('Failed to create staff', error.message);
    }
  }

  async findAll(user: USER, page: number, perPage: number, search: string, start_date_from: Date, start_date_to: Date): Promise<Object> { 
    try{

      page = page ? Number(page) : 1;
      perPage = perPage ? Number(perPage) : 10;

      const skip =(page - 1) * perPage;
      const take = perPage;

      const where: any = {
        hireRequest: {},
      }

      if (user.role.includes('organization')) {
        where.hireRequest.org_id = user.organization_id;
      }
  
      if (search) {
        where.hireRequest.title = { contains: search, mode: 'insensitive' };
      }
  
      if (start_date_from || start_date_to) {
        where.start_date = {};
        if (start_date_from) where.start_date.gte = new Date(start_date_from);
        if (start_date_to) where.start_date.lte = new Date(start_date_to);
      }

      const select = {
        id: true,
        hirerequest_id: true,
        status: true,
        salary: true,
        start_date: true,
        created_at: true,
        updated_at: true,
        candidate:{
          select:{
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            specialization: true,
            employment_type: true,
            country: true,
            about_me: true,
            languages: {
              select: {
                name: true,
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
            pay_rate: true,
            description: true,
            created_at: true,
            created_by: true,
          }
        }
      }

      const [staff, total] = await this.prisma.$transaction([
        this.prisma.staff.findMany({
          where,
          skip,
          take,
          select,
        }),
        this.prisma.staff.count({where})
      ]);
     

      return {
        data: staff,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(Number(total) / perPage)
        }
      };
    }catch(error){
      throw new BadRequestException('Failed to retrieve staff records', error.message);
    }
  }

}
