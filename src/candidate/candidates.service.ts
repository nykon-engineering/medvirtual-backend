import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, USER } from '@prisma/client';
import * as path from 'path';

import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import { PrismaService } from '../prisma/prisma.service';
import { extractDriveFileId } from '../common/utils/hubspot.util';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { TextractService } from '../textract/textract.service';
import { S3Service } from '../s3/s3.service';
import { OpenaiService } from '../openai/openai.service';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

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

  async update(id: string, data: UpdateCandidateDto): Promise<any> {
    if (!id) throw new BadRequestException('Candidate ID is required');
    if (!data) throw new BadRequestException('Update data is required');

    if (data.pipeline_status) {
      const stageName = Object.entries(dbToStageDictionary).find(([key, value]) => value.toLowerCase() === data.pipeline_status?.toLowerCase())?.[0];
      data.pipeline_status = stageName || 'Unknown Stage';
    }

    const updatedCandidate = await this.prisma.candidate.update({
      where: { id: id },
      data: {
        ...data
      }
    });
    if(!updatedCandidate) throw new BadGatewayException('Failed to update candidate');
    return updatedCandidate;

  }

  async updateFromJson(id: string, jsonData: any): Promise<boolean> {
    //create function to get datas and populate different tables
    if (!id) throw new BadRequestException('Candidate ID is required');
    if (!jsonData) throw new BadRequestException('JSON data is required');

    if (jsonData.education !== '' && jsonData.education !== undefined) {
      console.log('Processing education data:', jsonData.education);
      const educationData = jsonData.education;
      if (Array.isArray(educationData)) {
        await this.prisma.candidateEducation.createMany({
          data: educationData.map(item => ({
            candidate_id: id,
            institution: item.institution || '',
            degree: item.degree || '',
            year: item.end_date || '',
          }))
        });
      }
    }

    /*
    education ->  CandidateEducation
    experience -> CandidateExperience
    skills -> CandidateSkill
    */

    return true;
  }

  async processData(id: string){
    if (!id) throw new BadRequestException('Candidate ID is required');

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
    else throw new BadRequestException('Error downloading file from Google Drive. Invalid file ID.');

    //processing_uploadFile
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_uploadFile' }
    })
    const bucketFile = await this.s3.uploadFile(path.join(downloadDir, pdfName), `candidates/${pdfName}`);
    if (!bucketFile) throw new BadGatewayException('Failed to upload file to S3 bucket');

    //processing_extractData
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_extractData' }
    })
    const jobId = await this.textract.startTextracktJob(bucketFile);
    if (!jobId) throw new BadGatewayException('Failed to start Textract job');

    //processing_extractText
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_extractText' }
    })
    const extract = await this.textract.getTextractResult(jobId);
    if(!extract) throw new BadGatewayException('Failed to extract text from resume');

    //processing_organizeData
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'processing_organizeData' }
    })
    const organizedData = await this.openai.organizeText(extract);
    if (!organizedData) throw new BadGatewayException('Failed to organize data from OpenAI');


    console.log('Organized data from OpenAI:', organizedData);
    console.log('Name: ', JSON.parse(organizedData).name);
    console.log('Bio: ', JSON.parse(organizedData).bio);

    //processing_updateCandidate
    await this.prisma.candidate.update({
      where: { id: id },
      data: { 
        processing_status: 'processing_organizeData',
        processed_resume_data: JSON.parse(organizedData),
        processed_at: new Date(),
        about_me: JSON.parse(organizedData).bio
       }
    })
    //call function to populate skills, education, experience....
    const populateDatas = await this.updateFromJson(id, JSON.parse(organizedData));
    if (!populateDatas) throw new BadGatewayException('Failed to populate candidate data from JSON');

    //completed
    await this.prisma.candidate.update({
      where: { id: id },
      data: { processing_status: 'completed' }
    })
    return organizedData;

  }

  async getPipelines() {
    const pipelines = Object.entries(dbToStageDictionary).map(([key, value]) => ({
      name: value
    }));
    if (!pipelines || pipelines.length === 0) throw new NotFoundException('No pipelines found');
    return pipelines;
  }
}
