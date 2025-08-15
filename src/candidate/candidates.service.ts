import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProcessingStatus, USER } from '@prisma/client';
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

  async findAll(
    user: USER, 
    country?: string, 
    avaliability?: string, 
    monthly_compensation_from?: string, 
    monthly_compensation_to?: string, 
    years_of_experience?: string,
    specialization?: string,
    skills?: string,
    languages?: string,
    page?: number,
    perPage?: number
  ): Promise <any> {

    page = page ? Number(page) : 1;
    perPage = perPage ? Number(perPage) : 10;

    const skip =(page - 1) * perPage;
    const take = perPage;
    const {organization_id} = user;    

    const hourly_from = monthly_compensation_from ? Number(monthly_compensation_from) / (Number(process.env.CANDIDATE_HOUR_PER_MONTH) * Number(process.env.CANDIDATE_PERCENT)) : undefined; 
    const hourly_to = monthly_compensation_to ? Number(monthly_compensation_to) / (Number(process.env.CANDIDATE_HOUR_PER_MONTH) * Number(process.env.CANDIDATE_PERCENT)) : undefined; 

    const languagesArray = languages ?
    languages.split(',').map(l => l.trim()).filter(Boolean)
    : [];
    const languageFilter = languagesArray?.length
    ? {
        languages: {
          some: {
            name: { in: languagesArray }
          }
        }
      }
    : {};

    const skillsArray = skills ? 
    skills.split(',').map(s => s.trim()).filter(Boolean)
    : [];
    console.log(skillsArray)
    const skillFilter = skillsArray?.length
    ? {
        skills: {
          some: {
            skill_name: { 
              in: skillsArray
            }
          }
        }
      }
    : {};

    // Calculate limit date
    let experienceFilter = {};
    if (years_of_experience) {
      const years = Number(years_of_experience);
      const today = new Date();
      const cutoffDate = new Date(today.setFullYear(today.getFullYear() - years));

      experienceFilter = {
        experiences: {
          some: {
            start_date: { lte: cutoffDate }
          }
        }
      };
    }

    const where = {
      OR:[
        {
          country: country ? country : undefined,
          employment_type: avaliability ? avaliability : undefined,
          specialization: specialization ? specialization : undefined,
          hourly_pay_rate: {
            gte: hourly_from ? hourly_from : undefined,
            lte: hourly_to ? hourly_to : undefined
          },
          organization_id: organization_id,
          pipeline_status: '261075105',
          ...skillFilter,
          ...languageFilter,
          ...experienceFilter,
        },
        {
          country: country ? country : undefined,
          employment_type: avaliability ? avaliability : undefined,
          specialization: specialization ? specialization : undefined,
          hourly_pay_rate: {
            gte: hourly_from ? hourly_from : undefined,
            lte: hourly_to ? hourly_to : undefined
          },
          organization_id: null, // This allows candidates without an organization_id to be included
          pipeline_status: '261075105',
          ...skillFilter,
          ...languageFilter,
          ...experienceFilter
        },
        {
          country: country ? country : undefined,
          employment_type: avaliability ? avaliability : undefined,
          specialization: specialization ? specialization : undefined,
          hourly_pay_rate: {
            gte: hourly_from ? hourly_from : undefined,
            lte: hourly_to ? hourly_to : undefined
          },
          organization_id: organization_id,
          pipeline_status: '1087596819',
          ...skillFilter,
          ...languageFilter,
          ...experienceFilter
        },
        {
          country: country ? country : undefined,
          employment_type: avaliability ? avaliability : undefined,
          specialization: specialization ? specialization : undefined,
          hourly_pay_rate: {
            gte: hourly_from ? hourly_from : undefined,
            lte: hourly_to ? hourly_to : undefined
          },
          organization_id: null, // This allows candidates without an organization_id to be included
          pipeline_status: '1087596819',
          ...skillFilter,
          ...languageFilter,
          ...experienceFilter
        }
      ]
    }
    const select ={
      id: true,
      first_name: true,
      last_name: true,
      name: true,
      email: true,
      country: true,
      employment_type: true,
      hourly_pay_rate: true,
      years_of_experience: true,
      pipeline_status: true, // This will be converted to name later
      about_me: true,
      specialization: true,
      tools: true,
      medical_tools: true,
      languages: {
        select: {
          name: true,
        }
      },
      skills: {
        select: {
          skill_name: true
        }
      },
      educations: {
        select: {
          institution: true,
          degree: true,
          year: true
        }
      },
      experiences: {
        orderBy: { start_date: Prisma.SortOrder.asc },
        select: {
          company: true,
          position: true,
          start_date: true,
          end_date: true,
          responsabilities: true
        } 
      }
    }


    try{
      const [candidates, total] = await this.prisma.$transaction([
        this.prisma.candidate.findMany({
          where,
          skip,
          take,
          select,
        }),
        this.prisma.candidate.count({where})
      ])
      
      //change pipeline_status to name
      candidates.forEach(candidate => {
        if (candidate.pipeline_status) {
          const stageName = dbToStageDictionary[Number(candidate.pipeline_status)];
          candidate.pipeline_status = stageName || 'Unknown Stage';
        }
      });

      return {
        data: candidates,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(Number(total) / perPage)
        }
      };
    }catch(error){
      throw new BadGatewayException('Failed to fetch candidates', error.message);
    }
  }

  async findOne(id: string, user: USER) {
    const {organization_id} = user;
    if (!id) throw new BadRequestException('Candidate ID is required');

    const select ={
      id: true,
      first_name: true,
      last_name: true,
      name: true,
      email: true,
      country: true,
      employment_type: true,
      hourly_pay_rate: true,
      years_of_experience: true,
      pipeline_status: true, // This will be converted to name later
      about_me: true,
      specialization: true,
      tools: true,
      medical_tools: true,
      languages: {
        select: {
          name: true,
        }
      },
      skills: {
        select: {
          skill_name: true,
          skill_type: true
        }
      },
      educations: {
        select: {
          institution: true,
          degree: true,
          year: true
        }
      },
      experiences: {
        orderBy: { start_date: Prisma.SortOrder.asc },
        select: {
          company: true,
          position: true,
          start_date: true,
          end_date: true,
          responsabilities: true
        }
      }
      
    }
  
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        id: id,
        organization_id: organization_id
      },
      select,
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

  private async updateStatus(id: string, status: ProcessingStatus): Promise<void> {
    await this.prisma.candidate.update({
      where: { id },
      data: { processing_status: status }
    });
  }

  async updateFromJson(id: string, jsonData: any): Promise<boolean> {
    //create function to get datas and populate different tables
    if (!id) throw new BadRequestException('Candidate ID is required');
    if (!jsonData) throw new BadRequestException('JSON data is required');

    //Clear database to avoid duplicates
    await this.prisma.candidateEducation.deleteMany({
      where: { candidate_id: id }
    })
    await this.prisma.candidateExperience.deleteMany({
      where: { candidate_id: id }
    })

    if (jsonData.education !== '' && jsonData.education !== undefined) {
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

    if(jsonData.experience !== '' && jsonData.experience !== undefined){
      const experienceData = jsonData.experience;

      if (Array.isArray(experienceData)) {
        await this.prisma.candidateExperience.createMany({
          data: experienceData.map(item => ({
            candidate_id: id,
            company: item.company || '',
            position: item.role || '',
            start_date: new Date(item.start_date) || '',
            end_date: new Date(item.end_date) || '',
            responsabilities: item.description || '',
            
          }))
        });
      }
    }
    return true
  }

  async processData(id: string): Promise<boolean>{
    console.log('starting process data for candidate ID:', id);
    if (!id) throw new BadRequestException('Candidate ID is required');

    const candidate = await this.prisma.candidate.findUnique({
      where: {
        id: id
      }
    });
    if( candidate && candidate.resume_url && candidate.resume_url.includes('http')) {

      const idFile = extractDriveFileId(candidate.resume_url);
      console.log('Extracted file ID from URL:', idFile);

      const pdfName = `${candidate.id}_resume.pdf`;
      const downloadDir = path.resolve(__dirname, '/tmp');

      //processing_downloadFile
      await this.updateStatus(id, 'processing_downloadFile');
      if (idFile) {
        await this.google.downloadFile(idFile, pdfName, downloadDir, id);
      }else{
        throw new BadRequestException('Error downloading file from Google Drive. Invalid file ID.');
      } 

      //processing_uploadFile
      await this.updateStatus(id, 'processing_uploadFile');
      const bucketFile = await this.s3.uploadFile(path.join(downloadDir, pdfName), `candidates/${pdfName}`);
      if (!bucketFile) throw new BadGatewayException('Failed to upload file to S3 bucket');

      //processing_extractData
      await this.updateStatus(id, 'processing_extractData');
      const jobId = await this.textract.startTextracktJob(bucketFile);
      if (!jobId) throw new BadGatewayException('Failed to start Textract job');

      //processing_extractText
      await this.updateStatus(id, 'processing_extractText');
      const extract = await this.textract.getTextractResult(jobId);
      if(!extract) throw new BadGatewayException('Failed to extract text from resume');

      //processing_organizeData
      await this.updateStatus(id, 'processing_organizeData');
      
      const organizedData = await this.openai.organizeText(extract, candidate);
      if (!organizedData) throw new BadGatewayException('Failed to organize data from OpenAI');
      const parsedData = JSON.parse(organizedData);
      console.log('The datas were organized successfully by openAi');

      //processing_updateCandidate
      await this.prisma.candidate.update({
        where: { id: id },
        data: { 
          processing_status: 'processing_updateCandidate',
          processed_resume_data: parsedData,
          processed_at: new Date(),
          about_me: parsedData.bio,
          years_of_experience: parsedData.years_of_experience || 0,
        }
      })
      //call function to populate skills, education, experience....
      const populateDatas = await this.updateFromJson(id, parsedData);
      if (!populateDatas) throw new BadGatewayException('Failed to populate candidate data from JSON');

      //completed
      await this.updateStatus(id, 'completed');
      
      
    }

    return true;
  }

  async getPipelines() {
    const pipelines = Object.entries(dbToStageDictionary).map(([key, value]) => ({
      name: value
    }));
    if (!pipelines || pipelines.length === 0) throw new NotFoundException('No pipelines found');
    return pipelines;
  }

  async getProperties(data): Promise<any> {
    try {
      const fields = data.fields ? data.fields.split(',').map((field) => field.trim()) : [];
      let result: Record<string, any> = {};
      let returned

      for (const field of fields) {
        if (field === 'languages'){
          returned = await this.prisma.candidateLanguage.findMany({
            where: {
              candidate: {
                pipeline_status: {
                  in: ['1087596819', '261075105'],
                },
              },
            },
            select: {
              name: true,
            },
            distinct: ['name'],
          });
        }else if (field === 'skills'){
          returned = await this.prisma.candidateSkill.findMany({
            where: {
              candidate: {
                pipeline_status: {
                  in: ['1087596819', '261075105'],
                },
              },
            },
            select: {
              skill_name: true,
            },
            distinct: ['skill_name'],
          });

          
        }else{
          returned = await this.prisma.candidate.findMany({
            where: {
              OR:[
                {pipeline_status: '261075105'},
                {pipeline_status: '1087596819'}
              ],
              AND: [
                {
                  [field]: {
                    not: null
                  }
                }
              ] 
            },
            distinct: ['country'],
            select: {
              [field]: true
            },
          })
        }

        result[field]=returned;
      }
      return result;
        
    } catch (error) {
        throw new BadRequestException(`Error fetching countries: ${error.message}`);
    }
  }

}
