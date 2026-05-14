// s3.service.ts
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { extname } from 'path';
import * as mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

@Injectable()
export class S3Service {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: 'us-east-1',
    });
  }

  async uploadFile(
    localFilePath: string,
    originalFileName: string,
    bucketName: string,
  ): Promise<string> {
    const fileContent = fs.readFileSync(localFilePath);
    const contentType =
      mime.lookup(originalFileName) || 'application/octet-stream';

    const fileName = `${uuidv4()}${extname(originalFileName)}`;

    const params: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);
    await this.s3.send(command);
    console.log(`File uploaded successfully. ${fileName}`);
    return fileName;
  }
}
