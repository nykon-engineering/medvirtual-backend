import { ApiProperty } from '@nestjs/swagger';
import { ProcessingStatus } from '@prisma/client';
import { IsIn, IsString } from 'class-validator';

export class reRunPipelineDto {
  @ApiProperty({
    description: 'Status of the pipeline to re-run',
    required: true,
    example:
      'processing_downloadFile, processing_uploadFile, processingextractData',
    enum: [
      'processing_downloadFile',
      'processing_uploadFile',
      'processing_extractData',
      'processing_extractText',
      'processing_organizeData',
      'processing_updateCandidate',
      'failed',
    ],
  })
  @IsString()
  @IsIn([
    'processing_downloadFile',
    'processing_uploadFile',
    'processing_extractData',
    'processing_extractText',
    'processing_organizeData',
    'processing_updateCandidate',
    'failed',
  ])
  status: ProcessingStatus;
}
