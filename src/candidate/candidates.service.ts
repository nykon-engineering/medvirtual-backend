import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { USER } from '@prisma/client';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CandidatesService {

  constructor(
    private readonly prisma: PrismaService
  ){}


  async findAll(user: USER, status: string) {

    let statusOnDb;
    const {organization_id} = user;
    if(status){
      statusOnDb = Object.entries(dbToStageDictionary).find(([key, value]) => value.toLowerCase() === status.toLowerCase())?.[0];
    }

    try{
      const candidates = await this.prisma.candidate.findMany({
        where:{
          organization_id: organization_id,
          pipeline_status: statusOnDb ? String(statusOnDb) : undefined
        }
      })

      return candidates;
    }catch(error){
      throw new BadGatewayException('Failed to fetch candidates');
    }

    
    //find all candidates from the same origanizationID of the current user => these are the hired candidates
    //find all candidates from a third table [id, organization_id, candidate_id, pipeline_status, created_at, update_at ] where organization_id = user.organization_id
  }

  async findOne(id: string, user: USER) {
    const {organization_id} = user;

    try{
      const candidate = await this.prisma.candidate.findUnique({
        where: {
          id: id,
          organization_id: organization_id
        }
      });
      return candidate;
    }catch(error){
      throw new BadGatewayException('Failed to fetch candidate');
    }
  }

 
}
