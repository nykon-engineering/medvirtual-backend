import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";


export class filtersGetCandidatesDto{
    @IsString()
    field: string;
    
    @IsString()
    value: string
}

export class GetCandidatesDto {
    @ApiProperty({ required: true, description: 'Virtual Assistant identifier' })
    @IsString()
    @IsNotEmpty()
    virtualAssistant: string;

    @ApiProperty({ description: 'Array with names fields to show on return', type: [String], example: ['name', 'id', 'agent_status', 'status', 'stage', 'country', 'date_of_birth', 'email',] })
    properties?: string[];

    @ApiProperty({ description: 'Object with field and value to apply on search', type: () => filtersGetCandidatesDto, isArray: true, example: [{ field: 'pipeline', value: '99999999' }, { field: 'stage', value: '99999999' }] })
    filters?: filtersGetCandidatesDto[];
}