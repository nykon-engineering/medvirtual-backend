import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { USER } from '@prisma/client';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import { PrismaService } from '../prisma/prisma.service';
import { extractDriveFileId } from '../common/utils/hubspot.util';
import { GoogledriveService } from '../googledrive/googledrive.service';

@Injectable()
export class CandidatesService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogledriveService
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
          pipeline_status: statusOnDb ? String(statusOnDb) : undefined,
          OR: [
            { organization_id: organization_id },
            { organization_id: null } // This allows candidates without an organization_id to be included
          ]
          
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

  async processData(id: string){

    if (!id) throw new BadRequestException('Candidate ID is required');

    //get url resume from db
    //download resume to temp files
    //send to textract service
    //call openAi
    //fill database with datas from openAI


    const candidate = await this.prisma.candidate.findUnique({
      where: {
        id: id
      }
    });
    if(!candidate) throw new NotFoundException('Candidate not found');
    if(!candidate.resume_url) throw new BadRequestException('Candidate resume URL is empty');

    const idFile = extractDriveFileId(candidate.resume_url);
    console.log('idFile:', idFile);
    const pdfName = `${candidate.first_name}_${candidate.last_name}_resume.pdf`;
    if (idFile) await this.google.downloadFile(idFile, pdfName);



    console.log(candidate)
  } 
 
}
