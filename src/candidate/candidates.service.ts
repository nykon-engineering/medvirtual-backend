import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { USER } from '@prisma/client';
import * as path from 'path';

import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import { PrismaService } from '../prisma/prisma.service';
import { extractDriveFileId } from '../common/utils/hubspot.util';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { TextractService } from '../textract/textract.service';
import { S3Service } from '../s3/s3.service';
import { OpenaiService } from '../openai/openai.service';

@Injectable()
export class CandidatesService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogledriveService,
    private readonly textract: TextractService,
    private readonly s3: S3Service,
    private readonly openai: OpenaiService
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
    if (!id) throw new BadRequestException('Candidate ID is required');
  
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        id: id,
        organization_id: organization_id
      }
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
    
  }

  async processData(id: string){

    if (!id) throw new BadRequestException('Candidate ID is required');

    //update candidate status_processing => processing
    //get url resume from db
    //download resume to temp files
    //send to textract service
    //call openAi
    //fill database with datas from openAI
    //update candidate status_processing => processed


    const candidate = await this.prisma.candidate.findUnique({
      where: {
        id: id
      }
    });
    if(!candidate) throw new NotFoundException('Candidate not found');
    if(!candidate.resume_url) throw new BadRequestException('Candidate resume URL is empty');

    const idFile = extractDriveFileId(candidate.resume_url);

    const pdfName = `${candidate.first_name}_${candidate.last_name}_resume.pdf`;
    const downloadDir = path.resolve(__dirname, '/tmp/downloads');
    if (idFile) await this.google.downloadFile(idFile, pdfName, downloadDir);
    console.log('File downloaded by google oAuth:', pdfName);
    
    const bucketFile = await this.s3.uploadFile(path.join(downloadDir, pdfName), `candidates/${pdfName}`);
    console.log('File uploaded to S3:', bucketFile);

    const jobId = await this.textract.startTextracktJob(bucketFile);
    console.log('Textract job started with ID:', jobId);

    const extract = await this.textract.getTextractResult(jobId);
    console.log('Textract extraction result:', extract);
    

    if (!extract) throw new BadGatewayException('Failed to extract text from resume');
    const organizedData = await this.openai.organizeText(extract);
    console.log('Organized data from OpenAI:', organizedData);

  }
 
}
