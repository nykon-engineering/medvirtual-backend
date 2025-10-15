import { BadGatewayException, BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProcessingStatus, USER } from '@prisma/client';
import * as path from 'path';

import { dbToStageDictionary, stageToDbDictionary } from '../common/dictionaries/stage-dictionary';
import { PrismaService } from '../prisma/prisma.service';
import { changeLabelAvailability, extractDriveFileId } from '../common/utils/hubspot.util';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { TextractService } from '../textract/textract.service';
import { S3Service } from '../s3/s3.service';
import { OpenaiService } from '../openai/openai.service';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { updateStatusHubspotDTO } from './dto/updateStatus-candidate.dto';
import axios from 'axios';
import { EndorseCandidateDto } from './dto/endorse-candidate.dto';
import { HubspotService } from '../hubspot/hubspot.service';
import { MailService } from '../mail/mail.service';
import { findHourlySalary, findMonthlySalary } from '../common/utils/salary.util';


@Injectable()
export class CandidatesService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogledriveService,
    private readonly textract: TextractService,
    private readonly s3: S3Service,
    private readonly openai: OpenaiService,
    @Inject(forwardRef(() => HubspotService))
    private readonly hubspot: HubspotService,
    private readonly mailService: MailService,
  ){}

  async findAll(
    user: USER, 
    country?: string, 
    availability?: string, 
    monthly_compensation_from?: string, 
    monthly_compensation_to?: string, 
    years_of_experience?: string,
    specializations?: string,
    skills?: string,
    languages?: string,
    page?: number,
    perPage?: number,
    search?: string
  ): Promise <any> {

    page = page ? Number(page) : 1;
    perPage = perPage ? Number(perPage) : 10;

    const skip =(page - 1) * perPage;
    const take = perPage;

    
    
    if (!user || user.role.includes("organization") && !user.organization_id) 
      throw new BadRequestException('The current user doent have an organization_id');

    const {organization_id} = user;

    const hourly_from = monthly_compensation_from ? findHourlySalary(Number(monthly_compensation_from)) : undefined; 
    const hourly_to = monthly_compensation_to ? findHourlySalary(Number(monthly_compensation_to)) : undefined; 

    const combinedFilters: Record<string, any>[] = [];

    const availabilityArray = availability
      ? availability.split(',').map((a) => a.trim()).filter(Boolean)
      : [];
    const availabilityNumbers = availabilityArray.map(a => stageToDbDictionary[a]).filter(Boolean).map(av => String(av));


    const languagesArray = languages ?
    languages.split(',').map(l => l.trim()).filter(Boolean)
    : [];
    const skillsArray = skills ? 
    skills.split(',').map(s => s.trim()).filter(Boolean)
    : [];
    const specializationArray = specializations 
    ? specializations.split(',').map(s => s.trim()).filter(Boolean) 
    : [];
    
    if (languagesArray.length) {
      combinedFilters.push(
        ...languagesArray.map(lang => ({
          languages: { some: { name: lang } }
        }))
      );
    }

    if (skillsArray.length) {
      combinedFilters.push(
        ...skillsArray.map(skill => ({
          skills: { some: { skill_name: { contains: skill, mode: 'insensitive' } } }
        }))
      );
    }
    if (specializationArray.length) {
      combinedFilters.push(
        ...specializationArray.map(spec => ({
          specialization: { contains: spec, mode: 'insensitive' }
        }))
      );
    }

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


    const searchFilter = search
    ? {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { last_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { email: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      }
    : {};


    const where = {
      OR: [
        {
          ...(country && { country }),
          ...(availabilityNumbers.length > 0 ? { employment_type: { in: availabilityNumbers.map(String) } } : (availability ? { employment_type: String(stageToDbDictionary[availability]) } : {})),
          ...(hourly_from !== undefined || hourly_to !== undefined ? {
            hourly_pay_rate: {
              ...(hourly_from !== undefined && { gte: hourly_from }),
              ...(hourly_to !== undefined && { lte: hourly_to })
            }
          } : {}),
          organization_id: organization_id,
          pipeline_status: '261075105',
          ...(combinedFilters.length > 0 && { AND: combinedFilters }),
          ...experienceFilter,
          ...searchFilter,
        },
        {
          ...(country && { country }),
          ...(availabilityNumbers.length > 0 ? { employment_type: { in: availabilityNumbers.map(String) } } : (availability ? { employment_type: String(stageToDbDictionary[availability]) } : {})),
          ...(hourly_from !== undefined || hourly_to !== undefined ? {
            hourly_pay_rate: {
              ...(hourly_from !== undefined && { gte: hourly_from }),
              ...(hourly_to !== undefined && { lte: hourly_to })
            }
          } : {}),
          organization_id: null, // This allows candidates without an organization_id to be included
          pipeline_status: '261075105',
          ...(combinedFilters.length > 0 && { AND: combinedFilters }),
          ...experienceFilter,
          ...searchFilter,
        },
        {
          ...(country && { country }),
          ...(availabilityNumbers.length > 0 ? { employment_type: { in: availabilityNumbers.map(String) } } : (availability ? { employment_type: String(stageToDbDictionary[availability]) } : {})),
          ...(hourly_from !== undefined || hourly_to !== undefined ? {
            hourly_pay_rate: {
              ...(hourly_from !== undefined && { gte: hourly_from }),
              ...(hourly_to !== undefined && { lte: hourly_to })
            }
          } : {}),
          organization_id: organization_id,
          pipeline_status: '1087596819',
          ...(combinedFilters.length > 0 && { AND: combinedFilters }),
          ...experienceFilter,
          ...searchFilter,
        },
        {
          ...(country && { country }),
          ...(availabilityNumbers.length > 0 ? { employment_type: { in: availabilityNumbers.map(String) } } : (availability ? { employment_type: String(stageToDbDictionary[availability]) } : {})),
          ...(hourly_from !== undefined || hourly_to !== undefined ? {
            hourly_pay_rate: {
              ...(hourly_from !== undefined && { gte: hourly_from }),
              ...(hourly_to !== undefined && { lte: hourly_to })
            }
          } : {}),
          organization_id: null, // This allows candidates without an organization_id to be included
          pipeline_status: '1087596819',
          ...(combinedFilters.length > 0 && { AND: combinedFilters }),
          ...experienceFilter,
          ...searchFilter,
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
      processing_status: true,
      processing_error: true,
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
        orderBy: { start_date: Prisma.SortOrder.desc },
        select: {
          company: true,
          position: true,
          start_date: true,
          end_date: true,
          responsabilities: true
        } 
      },
      selectedInInterviews: {
        select: {
          scheduled_date: true,
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
      
      candidates.forEach(candidate => {
        if (candidate.pipeline_status) {
          const stageName = dbToStageDictionary[Number(candidate.pipeline_status)];
          candidate.pipeline_status = stageName || 'Unknown Stage';
        }
        
      });

      const candidateIds = candidates.map(candidate => candidate.id);
      
      const interviewRequestTickets = await this.prisma.ticket.findMany({
        where: {
          organization: { is: { id: organization_id || undefined} },
          type: 'interview',
          status: {
            in: ['new', 'in_progress']
          },
          candidate_id: {
            in: candidateIds
          }
        },
        select: {
          candidate_id: true
        }
      });

      const candidatesWithInterviewScheduled = new Set(
        interviewRequestTickets.map(ticket => ticket.candidate_id)
      );

      const candidatesWithScheduledInterview = candidates.map(candidate => ({
        ...candidate,
        employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
        scheduledInterviewDate: candidate.selectedInInterviews[0]?.scheduled_date || null,
        hasInterviewScheduled: candidatesWithInterviewScheduled.has(candidate.id),
        selectedInInterviews: undefined,
        salary: findMonthlySalary(candidate.hourly_pay_rate?.toNumber() || 0)
      }));

      return {
        data: candidatesWithScheduledInterview,
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
        orderBy: { start_date: Prisma.SortOrder.desc },
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
    candidate.employment_type = changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type;

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

  private async updateStatus(id: string, status: ProcessingStatus, error?: string): Promise<void> {
    await this.prisma.candidate.update({
      where: { id },
      data: { 
        processing_status: status,
        processing_error: error || null,
        processed_at: new Date()

       }
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

  async processAvatar(id: string): Promise<boolean>{
    console.log('starting process Avatar for candidate ID:', id);
    if (!id) throw new BadRequestException('Candidate ID is required');

    const candidate = await this.prisma.candidate.findUnique({
      where: {
        id: id
      }
    });
    if(!candidate) throw new BadRequestException('Candidate not found');

    //if( candidate && candidate.resume_url && candidate.resume_url.includes('http')) {  => handler with the field from hubspot, like resume_link
      //const idImage = '1AjdfgUU0qTwpBdEUKdEBH0R8mlgCnn4a';
      //const idImage = '1HsIGszx_8OMncDntKBCziUFHLdr5jYK2';
      //const idImage = '1nL-kL3dK0emQsH3xHY27DZQ9KuAf8rlw';
      const idImage = '1wa-egm9aaA-TSdvmQTvWz6cM6ZYzXqVB'
      //const idImage = extractDriveFileId(candidate.resume_url); => handler with the field from hubspot, like resume_link
      
      const imageName = `${candidate.id}__image.png`;
      const downloadDir = path.resolve(__dirname, '/tmp');

      const imageDownloaded = await this.google.downloadImage(idImage, imageName, downloadDir);
      if (!imageDownloaded ) {
        console.log('Failed to download image from Google Drive:', imageDownloaded);
      }
      console.log('Image downloaded successfully from Google Drive', imageDownloaded);
      
      console.log("starting with the avatar generate...")
      await this.openai.generateAvatarWithScreenshoot(candidate, imageDownloaded);
      console.log('Avatar generated successfully');

      //Save Avatar on S3 and update candidate database 

    //} 
    return true;
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

      const pdfName = `${candidate.id}_resume.pdf`;
      const downloadDir = path.resolve(__dirname, '/tmp');
     
      if (!idFile) {
        await this.updateStatus(id, 'failed', 'Error in extracting file ID from URL');
        return false;
      }
      
      console.log('starting with download step...');
      //processing_downloadFile
      await this.updateStatus(id, 'processing_downloadFile');
      const fileDownloaded = await this.google.downloadFile(idFile, pdfName, downloadDir);
      if (fileDownloaded !== 'Download successful') {

        //=> Send failed via email
        /*
        const candidateName = candidate.first_name ? `${candidate.first_name} ${candidate.last_name}` : `${candidate.name}`;
        const emailBody = googleDriveFailed(candidateName, fileDownloaded);
        const mailSent = await this.mailService.sendMail({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: 'paulo@regenta.ai',
        subject: 'Google Drive Failed',
        html: emailBody,
        });
        if (!mailSent) {
          console.error('Failed to send google drive failed email.');
        }
        */

        await this.updateStatus(id, 'failed', `${fileDownloaded}`);
        return false;
      }

      console.log('starting with upload step...');
      //processing_uploadFile
      await this.updateStatus(id, 'processing_uploadFile');
      const bucketFile = await this.s3.uploadFile(path.join(downloadDir, pdfName), `candidates/${pdfName}`);
      if (!bucketFile) {
        await this.updateStatus(id, 'failed', 'Failed to upload file to S3');
        console.log('Failed to upload file to S3');
        return false;
      }

      console.log('starting with first textract step...');
      //processing_extractData
      await this.updateStatus(id, 'processing_extractData');
      const jobId = await this.textract.startTextracktJob(bucketFile);
      if (!jobId) {
        await this.updateStatus(id, 'failed', 'Failed to start Textract job');
        console.log('Failed to start Textract job');
        return false;
      }

      console.log('starting with the second textract step...');
      //processing_extractText
      await this.updateStatus(id, 'processing_extractText');
      const extract = await this.textract.getTextractResult(jobId);
      if(!extract) {
        await this.updateStatus(id, 'failed', 'Failed to extract text from Textract');
        console.log('Failed to extract text from Textract');
        return false;
      }



      


      console.log('starting with the openAi step...');
      //processing_organizeData
      await this.updateStatus(id, 'processing_organizeData');   
      const organizedDataString = await this.openai.organizeText(extract, candidate);

      const organizedData = JSON.parse(organizedDataString);
      const transformedData = {
        ...organizedData,
        experience: organizedData.experience.map(exp => ({
          ...exp,
          description: exp.description.join("; ")
        })),
        education: organizedData.education.map(edu => ({
          ...edu,
          description: edu.description.join("; ")
        }))
      };
      
      if (!transformedData) {
        await this.updateStatus(id, 'failed', 'Failed to organize data from OpenAI');
        console.log('Failed to organize data from OpenAI');
        return false;
      }

      const parsedData = transformedData;
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
      if (!populateDatas){
        await this.updateStatus(id, 'failed');
        console.log('Failed to populate candidate data from JSON');
        return false;
      }

      //completed
      await this.updateStatus(id, 'completed');
      
      
    }else{
      await this.updateStatus(id, 'failed', 'Resume URL not found');
      return false;
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
              skill_name: {
                not: 'N/A',
              },
            },
            select: {
              skill_name: true,
            },
            distinct: ['skill_name'],
          });
        
        }else if (field === 'salary_range'){
          const max = await this.prisma.candidate.aggregate({
            _max: {
              hourly_pay_rate: true,
            },
            where: {
              pipeline_status: {
                in: ['1087596819', '261075105'],
              },
            },
          });

          const min = await this.prisma.candidate.aggregate({
            _min: {
              hourly_pay_rate: true,
            },
            where: {
              pipeline_status: {
                in: ['1087596819', '261075105'],
              },
            },
          });
          returned = {
            min: min._min.hourly_pay_rate || 0,
            salary_min: findMonthlySalary(Number(min._min.hourly_pay_rate) || 0),
            max: max._max.hourly_pay_rate || 0,
            salary_max: findMonthlySalary(Number(max._max.hourly_pay_rate) || 0),
          };
          
          result[field]=returned;

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
                },
                {
                  [field]: {
                    not: 'N/A'
                  }
                }
              ] 
            },
            distinct: [field],
            select: {
              [field]: true
            },
          })
        }

        if (field === 'specialization') {
          result[field] = [
            ...new Set(
              returned.flatMap(item =>
                item.specialization.split(';').map(s => s.trim()).filter(s => s !== 'N/A')
              )
            )
          ];
        }else{
          result[field]=returned;
        }

        
      }
      return result;
        
    } catch (error) {
        throw new BadRequestException(`Error fetching countries: ${error.message}`);
    }
  }

  async updateStatusHubspot(id: string, data: updateStatusHubspotDTO): Promise<any> {
    if (!id) throw new BadRequestException('Candidate ID is required');
    if (!data || !data.status) throw new BadRequestException('Status data is required');

    const stageName = Object.entries(dbToStageDictionary).find(([key, value]) => value.toLowerCase() === data.status?.toLowerCase())?.[0];
    if (!stageName) throw new BadRequestException('Invalid status provided');

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: id },
      select: { hubspot_id: true }
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const body = {
      properties: {
        hs_pipeline_stage: stageName
      }
    };

    //communication with hubspot to update status can be added here
    const response = await axios.patch(`https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${candidate.hubspot_id}`,
      body,
      {
          headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
          }
      }
  )

  if(response.status !== 200) {
    throw new BadGatewayException('Failed to update candidate status in HubSpot');
  }
    const updatedCandidate = await this.prisma.candidate.update({
      where: { id: id },
      data: {
        pipeline_status: stageName
      }
    });
    if(!updatedCandidate) throw new BadGatewayException('Failed to update candidate status');
    
    return updatedCandidate;
  }

  async showMatchHireRequests(user: USER, candidateId: string): Promise<object[]> {
    if (!user || (user.role.includes("organization") && !user.organization_id)) {
      throw new NotFoundException("User not found or not part of an organization");
    }
  
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        hourly_pay_rate: true,
        pipeline_status: true,
        country: true,
        specialization: true,
        employment_type: true,
        skills: { select: { skill_name: true, proficiency_level: true } },
      },
    });
  
    if (!candidate) throw new NotFoundException("Candidate not found");
  
    const hireRequests = await this.prisma.hireRequest.findMany({
      where: {
        status: 'sourcing',
        assigned_user:  user.role === 'system_admin' ?  { is : {id : user.id} } : undefined,
        panels:{
          some: {
            panelCandidates: {}
          }
        }
      },
      select: {
        id: true,
        title: true,
        description: true,
        specialization: true,
        location: true,
        availability: true,
        salary_range_from: true,
        salary_range_to: true,
        organization: { select: { id: true, name: true } },
        skills: { select: { skill_name: true, required_level: true } },
        panels: { select: { id: true, _count: {select: {panelCandidates: true}} } },
      },
    });
  
    const HOURS = Number(process.env.CANDIDATE_HOUR_PER_MONTH ?? 176);
    const PERCENT = Number(process.env.CANDIDATE_PERCENT ?? 1);
  
    const candidateSkills = candidate.skills.map((s) => s.skill_name);
  
    const scoredHireRequests = hireRequests.map((hr) => {
      let score = 0;
      const matchedCriteria: string[] = [];
  
      const hrSpecialization = hr.specialization
        ? hr.specialization.split(";").map((s) => s.trim())
        : [];
      if (
        hrSpecialization.length > 0 &&
        candidate.specialization &&
        hrSpecialization.includes(candidate.specialization)
      ) {
        score += 3;
        matchedCriteria.push(`${candidate.specialization}`);
      }
  
      if (hr.location && candidate.country === hr.location) {
        score += 2;
        matchedCriteria.push(`${hr.location}`);
      }
  
      if (hr.availability && candidate.employment_type === hr.availability) {
        score += 2;
        matchedCriteria.push(`${hr.availability}`);
      }
  
      const hourly_from = hr.salary_range_from
        ? findHourlySalary(Number(hr.salary_range_from))
        : undefined;
  
      const hourly_to = hr.salary_range_to
        ? findHourlySalary(Number(hr.salary_range_to))
        : undefined;
  
      if (
        candidate.hourly_pay_rate !== null &&
        hourly_from !== undefined &&
        hourly_to !== undefined &&
        candidate.hourly_pay_rate.toNumber() >= hourly_from &&
        candidate.hourly_pay_rate.toNumber() <= hourly_to
      ) {
        score += 3;
        matchedCriteria.push(
          `Salary between range`
        );
      }
  
      const requiredSkills = hr.skills.map((s) => s.skill_name);
      const matchedSkills = candidateSkills.filter((skill) =>
        requiredSkills.includes(skill)
      );
  
      const skillMatchPercent =
        requiredSkills.length > 0
          ? matchedSkills.length / requiredSkills.length
          : 0;

      if (matchedSkills.length > 0) {
        matchedCriteria.push(...matchedSkills);
      }
  
      score += skillMatchPercent * 10;
  
      return {
        ...hr,
        matchedSkills,
        matchedCriteria,
        score: Math.round(score * 100) / 100,
      };
    });
  
    scoredHireRequests.sort((a, b) => b.score - a.score);
    return scoredHireRequests;
  }
  
  async endorseCandidate(data: EndorseCandidateDto): Promise<boolean> {

    if (!data.candidateId) throw new BadRequestException('Candidate ID is required');
    if (!data.hireRequestId) throw new BadRequestException('Hire Request ID is required');

    const hire_request = await this.prisma.candidatePanel.findFirst({
      where: { hire_request_id: data.hireRequestId },
      select: { id: true }
    })
    if (!hire_request) throw new NotFoundException('Hire Request not found in candidate panel');

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: data.candidateId },
      select: { 
        hubspot_id: true,
        pipeline_status: true
       }
    });
    if (!candidate) throw new NotFoundException('Candidate not found');


    const newStatus = Object.entries(dbToStageDictionary).find(([key, value]) => value.toLowerCase() === 'endorsed via platform')?.[0];
    if (!newStatus) throw new BadRequestException('Invalid status mapping for Endorsed via platform');

    const [endorsement, candidateUpdated] = await this.prisma.$transaction([
      this.prisma.panelCandidate.create({
        data:{
          panel_id: hire_request.id,
          candidate_id: data.candidateId,
          status: 'selected',
        }
      }),
    
      this.prisma.candidate.update({
        where: { id: data.candidateId },
        data: { 
          pipeline_status_origin: candidate.pipeline_status,
          pipeline_status: newStatus 
        } 
      })
    ])
    if (!endorsement) throw new BadGatewayException('Failed to endorse candidate');
    if (!candidateUpdated) throw new BadGatewayException('Failed to update candidate status');

    await this.hubspot.updateOneCandidateFromHireRequest(candidate.hubspot_id, newStatus);

    return true;

  }

}


