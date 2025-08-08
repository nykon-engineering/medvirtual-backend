import { Injectable } from '@nestjs/common';
import {Textract } from "@aws-sdk/client-textract";

@Injectable()
export class TextractService {
    private textract = new Textract();
    /* istanbul ignore next */
    async startTextracktJob(file: string): Promise<string> {
        const response = await this.textract.startDocumentTextDetection({
            DocumentLocation:{
                S3Object:{
                    Bucket: 'medvirtual-documents',
                    Name: file,
                },
            },
        })
        if (!response.JobId) {
            throw new Error('Failed to start Textract job');
        }
        return response.JobId;
    }
    /* istanbul ignore next */
    async getTextractResult(jobId: string): Promise<any> {
        let status = 'IN_PROGRESS';
        let attempts = 0;
        const maxAttempts = 30; 

        while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
           const { JobStatus} = await this.textract.getDocumentTextDetection({ JobId: jobId });
           if ( JobStatus === 'SUCCEEDED') break;

           await new Promise(resolve => setTimeout(resolve, 5000)); 
           attempts++;
        }

        const result = await this.textract.getDocumentTextDetection({ JobId: jobId });
        const lines = result.Blocks?.filter(b => b.BlockType === 'LINE').map(b => b.Text) ?? [];
        console.log(`Textract job completed with status: ${status}, attempts: ${attempts}`);
        return lines.join('\n');
    }
}
