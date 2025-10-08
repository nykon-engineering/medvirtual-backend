import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { USER } from '@prisma/client';

import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { terminateDto } from './dto/terminate.dto';

import { PrismaService } from '../prisma/prisma.service';
import { staffStatusDictionary } from '../common/dictionaries/staff-status-dictionary';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

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
        hubspot_id: true,
        hubspot_close_date: true,
        hubspot_contract_sign_date: true,
        hubspot_conversion_type: true,
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
            languages: {
              select: {
                name: true,
              },
            },
            createdAt: true,
          },
        },
        hireRequest: {
          select: {
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
          },
        },
        bonus: {
          select: {
            id: true,
            amount: true,
            description: true,
            created_at: true,
            created_by: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
  }

  async create(createStaffDto: CreateStaffDto, user: USER) {
    try {
      const statusHandled = staffStatusDictionary[createStaffDto.status];
      const staff = await this.prisma.staff.create({
        data: {
          candidate_id: createStaffDto.candidate_id,
          hirerequest_id: createStaffDto.hirerequest_id,
          status: statusHandled,
          salary: createStaffDto.salary,
          start_date: createStaffDto.start_date,
          created_by: user.id,
        },
      });

      return await this.findOne(staff.id);
    } catch (error) {
      throw new BadRequestException('Failed to create staff', error);
    }
  }

  async addBonus(data: CreateBonusDto, user: USER): Promise<any> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: data.staff_id },
      select: {
        id: true,
        candidate_id: true,
        status: true,
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.status !== 'active')
      throw new BadRequestException(
        'Cannot add bonus to inactive staff member',
      );
    if (!user || (user.role.includes('organization') && !user.organization_id))
      throw new NotFoundException('User not found');

    let assignedValidated;

    if (user.role.includes('organization')) {
      //get the concierge client as assigned user
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organization_id || undefined },
        select: { admin_id: true },
      });
      if (!org) throw new BadRequestException('Organization not found');
      assignedValidated = org.admin_id;
    } else {
      assignedValidated = undefined;
    }

    const [bonus, ticket] = await this.prisma.$transaction([
      this.prisma.bonus.create({
        data: {
          staff_id: data.staff_id,
          amount: data.bonus,
          description: data.description,
          created_by: user.id,
        },
      }),
      this.prisma.ticket.create({
        data: {
          organization: { connect: { id: user.organization_id || undefined } },
          type: 'bonus',
          staff: { connect: { id: data.staff_id } },
          title: `Bonus Added: $${data.bonus} to ${staff?.candidate?.first_name} ${staff?.candidate?.last_name}`,
          description: data.description,
          priority: 'medium',
          user: assignedValidated
            ? { connect: { id: assignedValidated } }
            : undefined,
        },
      }),
    ]);
    return await this.findOne(data.staff_id);
  }

  async requestTermination(data: terminateDto, user: USER): Promise<any> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: data.staff_id },
      select: {
        id: true,
        candidate_id: true,
        status: true,
        hubspot_deal_name: true,
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            name: true,
          },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (!user || (user.role.includes('organization') && !user.organization_id))
      throw new NotFoundException('User not found');

    let assignedValidated;

    if (user.role.includes('organization')) {
      //get the concierge client as assigned user
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organization_id || undefined },
        select: { admin_id: true },
      });
      if (!org) throw new BadRequestException('Organization not found');
      assignedValidated = org.admin_id;
    } else {
      assignedValidated = undefined;
    }

    const [staffStatus, ticket] = await this.prisma.$transaction([
      this.prisma.staff.update({
        where: { id: staff.id },
        data: { status: 'termination-requested' },
      }),
      this.prisma.ticket.create({
        data: {
          organization: { connect: { id: user.organization_id || undefined } },
          staff: { connect: { id: staff.id } },
          type: 'termination',
          title: `Termination Requested: ${staff.hubspot_deal_name ? staff.hubspot_deal_name :  staff?.candidate?.first_name+` `+staff?.candidate?.last_name}`,
          description: data.description,
          priority: 'high',
          user: assignedValidated
            ? { connect: { id: assignedValidated } }
            : undefined,
        },
      }),
    ]);

    return await this.findOne(data.staff_id);
  }

  async getStaffForTickets(user: USER): Promise<object> {
    const where: any = {
      hireRequest: {},
    };

    if (user.role.includes('organization')) {
      where.hireRequest.org_id = user.organization_id;
    }

    const staff = await this.prisma.staff.findMany({
      where,
      select: {
        id: true,
        status: true,
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        hireRequest: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return staff;
  }

  async findAll(
    user: USER,
    page: number,
    perPage: number,
    search: string,
    start_date_from: Date,
    start_date_to: Date,
  ): Promise<object> {
    page = page ? Number(page) : 1;
    perPage = perPage ? Number(perPage) : 10;

    const skip = (page - 1) * perPage;
    const take = perPage;

    const where: any = {
      hireRequest: {},
      candidate: {},
    };

    if (user.role.includes('organization')) {
      //where.hireRequest.org_id = user.organization_id;
      where.OR = [
        {
          hireRequest: {
            org_id: user.organization_id,
          },
        },
        {
          organization_id: user.organization_id,
        },
      ];
    }

    if (search) {
      where.OR = [
        {
          hireRequest: {
            title: { contains: search, mode: 'insensitive' },
          },
        },
        {
          candidate: {
            first_name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          candidate: {
            last_name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
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
      hubspot_id: true,
      hubspot_close_date: true,
      hubspot_contract_sign_date: true,
      hubspot_conversion_type: true,
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
          createdAt: true,
        },
      },
      hireRequest: {
        select: {
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
        },
      },
      bonus: {
        select: {
          id: true,
          amount: true,
          description: true,
          created_at: true,
          created_by: true,
        },
      },
    };

    const [staff, total] = await this.prisma.$transaction([
      this.prisma.staff.findMany({
        where,
        skip,
        take,
        select,
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      status: 200,
      data: staff,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(Number(total) / perPage),
      },
    };
  }

  async updateStaff(
    staffId: string,
    updateData: any,
    user: USER,
  ): Promise<any> {
    try {
      // Verify staff exists
      const existingStaff = await this.prisma.staff.findUnique({
        where: { id: staffId },
        include: {
          candidate: true,
        },
      });

      if (!existingStaff) {
        throw new NotFoundException('Staff member not found');
      }

      // Extract staff-specific fields and candidate fields
      const {
        status,
      } = updateData;

      // Update staff record
      const staffUpdateData: any = {};
      if (status !== undefined) {
        staffUpdateData.status = staffStatusDictionary[status] || status;
      }
      
      // Use transaction to update both staff and candidate records
      const result = await this.prisma.$transaction(async (tx) => {
        // Update staff record
        const updatedStaff = await tx.staff.update({
          where: { id: staffId },
          data: staffUpdateData,
        });

        // Return updated staff with all relations
        return await tx.staff.findUnique({
          where: { id: staffId },
          select: {
            id: true,
            hirerequest_id: true,
            status: true,
            salary: true,
            start_date: true,
            created_at: true,
            updated_at: true,
            hubspot_id: true,
            hubspot_close_date: true,
            hubspot_contract_sign_date: true,
            hubspot_conversion_type: true,
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
                years_of_experience: true,
                hourly_pay_rate: true,
                gender: true,
                medical_tools: true,
                tools: true,
                languages: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                skills: {
                  select: {
                    id: true,
                    skill_name: true,
                    proficiency_level: true,
                    skill_type: true,
                  },
                },
                createdAt: true,
              },
            },
            hireRequest: {
              select: {
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
              },
            },
            bonus: {
              select: {
                id: true,
                amount: true,
                description: true,
                created_at: true,
                created_by: true,
              },
            },
          },
        });
      });

      return {
        status: 200,
        message: 'Staff updated successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update staff member');
    }
  }

  /* //We removed that method to simplify the code, but kept it here for reference
  async updateStaff(
    staffId: string,
    updateData: any,
    user: USER,
    ): Promise<any> {
    try {
      // Verify staff exists
      const existingStaff = await this.prisma.staff.findUnique({
        where: { id: staffId },
        include: {
          candidate: true,
        },
      });

      if (!existingStaff) {
        throw new NotFoundException('Staff member not found');
      }

      // Extract staff-specific fields and candidate fields
      const {
        status,
        salary,
        start_date,
        first_name,
        last_name,
        email,
        about_me,
        specialization,
        employment_type,
        country,
        years_of_experience,
        hourly_pay_rate,
        gender,
        medical_tools,
        tools,
        skills,
        languages,
      } = updateData;

      // Update staff record
      const staffUpdateData: any = {};
      if (status !== undefined) {
        staffUpdateData.status = staffStatusDictionary[status] || status;
      }
      if (salary !== undefined) {
        staffUpdateData.salary = salary;
      }
      if (start_date !== undefined) {
        staffUpdateData.start_date = start_date;
      }

      // Update candidate record
      const candidateUpdateData: any = {};
      if (first_name !== undefined) candidateUpdateData.first_name = first_name;
      if (last_name !== undefined) candidateUpdateData.last_name = last_name;
      if (email !== undefined) candidateUpdateData.email = email;
      if (about_me !== undefined) candidateUpdateData.about_me = about_me;
      if (specialization !== undefined)
        candidateUpdateData.specialization = specialization;
      if (employment_type !== undefined)
        candidateUpdateData.employment_type = employment_type;
      if (country !== undefined) candidateUpdateData.country = country;
      if (years_of_experience !== undefined)
        candidateUpdateData.years_of_experience = years_of_experience;
      if (hourly_pay_rate !== undefined)
        candidateUpdateData.hourly_pay_rate = hourly_pay_rate;
      if (gender !== undefined) candidateUpdateData.gender = gender;
      if (medical_tools !== undefined)
        candidateUpdateData.medical_tools = medical_tools;
      if (tools !== undefined) candidateUpdateData.tools = tools;

      // Use transaction to update both staff and candidate records
      const result = await this.prisma.$transaction(async (tx) => {
        // Update staff record
        const updatedStaff = await tx.staff.update({
          where: { id: staffId },
          data: staffUpdateData,
        });

        if (!existingStaff.candidate_id) {
          throw new NotFoundException('Staff member not found during update');
        }
        // Update candidate record
        const updatedCandidate = await tx.candidate.update({
          where: { id: existingStaff.candidate_id },
          data: candidateUpdateData,
        });

        // Handle skills update
        if (skills !== undefined) {
          // Delete existing skills
          await tx.candidateSkill.deleteMany({
            where: { candidate_id: existingStaff.candidate_id },
          });

          // Create new skills
          if (skills.length > 0) {
            await tx.candidateSkill.createMany({
              data: skills.map((skill: any) => ({
                candidate_id: existingStaff.candidate_id,
                skill_name: skill.skill_name,
                proficiency_level: skill.proficiency_level || 'intermediate',
                skill_type: skill.skill_type || 'technical',
              })),
            });
          }
        }

        // Handle languages update
        if (languages !== undefined) {
          // Delete existing languages
          await tx.candidateLanguage.deleteMany({
            where: { candidate_id: existingStaff.candidate_id },
          });

          // Create new languages
          if (languages.length > 0) {
            await tx.candidateLanguage.createMany({
              data: languages.map((language: any) => ({
                candidate_id: existingStaff.candidate_id,
                name: language.name,
              })),
            });
          }
        }

        // Return updated staff with all relations
        return await tx.staff.findUnique({
          where: { id: staffId },
          select: {
            id: true,
            hirerequest_id: true,
            status: true,
            salary: true,
            start_date: true,
            created_at: true,
            updated_at: true,
            candidate: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                specialization: true,
                employment_type: true,
                country: true,
                about_me: true,
                years_of_experience: true,
                hourly_pay_rate: true,
                gender: true,
                medical_tools: true,
                tools: true,
                languages: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                skills: {
                  select: {
                    id: true,
                    skill_name: true,
                    proficiency_level: true,
                    skill_type: true,
                  },
                },
                createdAt: true,
              },
            },
            hireRequest: {
              select: {
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
              },
            },
            bonus: {
              select: {
                id: true,
                amount: true,
                description: true,
                created_at: true,
                created_by: true,
              },
            },
          },
        });
      });

      return {
        status: 200,
        message: 'Staff updated successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update staff member');
    }
  }
    */

  
}
