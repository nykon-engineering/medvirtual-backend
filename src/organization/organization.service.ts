import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Body,
} from '@nestjs/common';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { Organization } from '@prisma/client';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService
  ) {}

  async getOwnerNameById(ownerId) {
    try {
      const response = await axios.get(`https://api.hubapi.com/crm/v3/owners/${ownerId}`, {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        }
      });
  
      const owner = response.data;
      return owner.fullName || `${owner.firstName} ${owner.lastName}`;
    } catch (error) {
      console.error(`Erro ao buscar owner ${ownerId}:`, error.response?.data || error.message);
      return null;
    }
  }

  async formatCompany(company) {
    const ownerIds = company.properties.hs_all_owner_ids;
  
    if (!ownerIds) {
      return company;
    }
  
    // Pode haver múltiplos IDs separados por `;`
    const ownerIdList = ownerIds.split(';');
  
    // Busca os nomes de todos os proprietários
    const ownerNames = await Promise.all(
      ownerIdList.map(id => this.getOwnerNameById(id))
    );
  
    // Substitui no objeto
    return {
      ...company,
      properties: {
        ...company.properties,
        hs_all_owner_names: ownerNames.filter(Boolean) // novo campo com nomes
      }
    };
  }

  async getAllFromHubspot(): Promise<any> {
    
    let objectOrganization;
    
    try{

      const result = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies/search',
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'business_unit',
                  operator: 'EQ',
                  value: 'MedVirtual',
                },
              ],
            },
          ],
          properties: [
            'agent_status',
            //'business_unit',
            'address',
            'name',
            'hs_all_assigned_business_unit_ids',
            'description',
            'domain',
            'hs_all_accessible_team_ids',
            'hs_all_owner_ids',
            'hs_all_team_ids',
          ],
          limit: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      objectOrganization=result.data.results;
      //console.log(result.data);

    }catch (error) {
      throw new BadRequestException('Failed to fetch organizations from Hubspot');
    }

    /*
    for ( const object of objectOrganization){
      if (object.properties.hs_all_owner_ids) {
        // Se o campo hs_all_owner_ids existir, substituímos o valor pelo nome do owner
        object.properties.hs_all_owner_names = await this.getOwnerNameById(object.properties.hs_all_owner_ids);
      }
      
    }
    */
    return objectOrganization; 
  }
  //These functions above is for get organizations from Hubspot
  //======== // ===========

  async getAll(): Promise<Organization[]> {

    try {
      return await this.prisma.organization.findMany({
        orderBy: {
          name: 'asc',
        },
      });
    } catch {
      throw new NotFoundException('Organizations not found');
    }
  }

  async getById(id: string): Promise<Organization> {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      return organization;
    } catch {
      throw new NotFoundException('Organization not found');
    }
  }

  async create(data: CreateOrganizationDto): Promise<Organization> {
    try {
      // Check if the organization already exists
      const existingOrganization = await this.prisma.organization.findUnique({
        where: { email: data.email },
      });
      
      if (existingOrganization) {
        throw new BadRequestException('Organization already exists');
      }
      const organization= await this.prisma.organization.create({
        data: {
          name: data.name,
          contact_info: data.cellphone,
          email: data.email,
        },
      });
      const dataInvitedUser = {
        email: data.super_admin_email,
        role: 'organization_super_admin',
        companyName: data.name,
        organizationId: organization.id,
      }

      await this.auth.inviteUser(dataInvitedUser);
      
      return organization;

    } catch(error) {
      console.log(error);
      throw new BadRequestException('Failed to create organization', error);
    }
  }

  async update(id: string, data: UpdateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.update({
        where: { id },
        data: {
          name: data.name,
          contact_info: data.cellphone,
          email: data.email,
        },
      });
    } catch {
      throw new BadRequestException('Failed to update organization');
    }
  }

  async delete(id: string): Promise<Organization> {
    try {
      return await this.prisma.organization.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException('Organization not found');
    }
  }
}
