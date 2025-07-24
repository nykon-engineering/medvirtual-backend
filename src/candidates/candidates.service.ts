import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { USER } from '@prisma/client';

@Injectable()
export class CandidatesService {


  async findAll(user: USER) {
    
    const {organization_id} = user;
    //find all candidates from the same origanizationID of the current user => these are the hired candidates
    //find all candidates from a third table [id, organization_id, candidate_id, pipeline_status, created_at, update_at ] where organization_id = user.organization_id
  }

  async findOne(id: number, user: USER) {
    return `This action returns a #${id} candidate`;
  }

  async update(id: number, user: USER, updateCandidateDto: UpdateCandidateDto) {
    //if the pipeline_status = 'hired', then update the organization_id 
    return `This action updates a #${id} candidate`;
  }

  async remove(id: number, user: USER) {
    return `This action removes a #${id} candidate`;
  }
}
