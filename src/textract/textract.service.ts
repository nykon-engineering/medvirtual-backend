import { Injectable } from '@nestjs/common';
import { Textract } from '@aws-sdk/client-textract';

@Injectable()
export class TextractService {
  private textract = new Textract();
  /* istanbul ignore next */
  async startTextracktJob(file: string): Promise<string> {
    const response = await this.textract.startDocumentTextDetection({
      DocumentLocation: {
        S3Object: {
          Bucket: 'medvirtual-documents',
          Name: file,
        },
      },
    });
    if (!response.JobId) {
      throw new Error('Failed to start Textract job');
    }
    return response.JobId;
  }
  /* istanbul ignore next */
  async getTextractResult(jobId: string): Promise<any> {
    const status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 30;
    let delay = 2000; //2 seconds

    while (attempts < maxAttempts) {
      const { JobStatus, Blocks } =
        await this.textract.getDocumentTextDetection({ JobId: jobId });

      if (JobStatus === 'SUCCEEDED') {
        const lines =
          Blocks?.filter((b) => b.BlockType === 'LINE').map((b) => b.Text) ??
          [];
        return lines.join('\n');
      }

      if (JobStatus === 'FAILED') {
        throw new Error(`Textract job failed with status: ${JobStatus}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 10000); // Exponential backoff, max 10 seconds
      attempts++;
    }

    throw new Error(
      `Textract job did not complete in time. Status: ${status}, attempts: ${attempts}`,
    );
  }
}
