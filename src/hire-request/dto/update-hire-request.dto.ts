import { PartialType } from '@nestjs/swagger';
import { CreateHireRequestDto } from './create-hire-request.dto';

export class UpdateHireRequestDto extends PartialType(CreateHireRequestDto) {}
