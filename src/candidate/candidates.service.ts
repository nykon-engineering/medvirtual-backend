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
      //change pipeline_status to name
      candidates.forEach(candidate => {
        if (candidate.pipeline_status) {
          const stageName = dbToStageDictionary[Number(candidate.pipeline_status)];
          candidate.pipeline_status = stageName || 'Unknown Stage';
        }
      });

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

    //change pipeline_status to name
    if (candidate.pipeline_status) {
      const stageName = dbToStageDictionary[Number(candidate.pipeline_status)];
      candidate.pipeline_status = stageName || 'Unknown Stage';
    }
    return candidate;
    
  }

  async updateFromJson(id: string, jsonData: any) {


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


    //processing_downloadFile
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_downloadFile' }
    })
    if (idFile) await this.google.downloadFile(idFile, pdfName, downloadDir);
    console.log('File downloaded by google oAuth:', pdfName);


    //processing_uploadFile
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_uploadFile' }
    })
    const bucketFile = await this.s3.uploadFile(path.join(downloadDir, pdfName), `candidates/${pdfName}`);
    console.log('File uploaded to S3:', bucketFile);

    //processing_extractData
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_extractData' }
    })
    const jobId = await this.textract.startTextracktJob(bucketFile);
    console.log('Textract job started with ID:', jobId);

    //processing_extractText
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_extractText' }
    })
    const extract = await this.textract.getTextractResult(jobId);
    console.log('Textract extraction result:', extract);

    //processing_organizeData
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_organizeData' }
    })
    if (!extract) throw new BadGatewayException('Failed to extract text from resume');
    const organizedData = await this.openai.organizeText(extract);
    console.log('Organized data from OpenAI:', organizedData);

    console.log('Bio: ', organizedData['bio']);


    //processing_updateCandidate
    /*
    await this.prisma.candidate.update({
      where: { id: id },
      data: { 
        processing_status: 'processing_organizeData',
        processed_resume_data: organizedData,
        processed_at: new Date(),
        about_me: organizedData['bio']
       }
    })

    */
    //call function to populate skills, education, experience....

    //completed
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'completed' }
    })
    return organizedData;

  }
 
}
