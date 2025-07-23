import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

export class changeDataToHubspotItemDto{
    @IsString()
    field: string;
    
    @IsString()
    value: string
}


export class changeDataToHubspotDto {
    @ApiProperty({ description: 'Object with field and value to change on the objectID', type: changeDataToHubspotItemDto , example: [{ field: 'pipeline', value: '99999999' }] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => changeDataToHubspotItemDto)
    properties: changeDataToHubspotItemDto[];
}