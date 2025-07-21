import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';

import { loadGoogleTokens } from './loadgoogletokens';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogledriveService {
    private readonly oauth2Client: OAuth2Client;

    constructor(
      private readonly prisma: PrismaService
    ) {
        this.oauth2Client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }


    generateAuthUrl(): string {
        const scopes = [
          'https://www.googleapis.com/auth/drive.readonly',
        ];

        const url =  this.oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          prompt: 'consent',
        });
        return url;
    }

    async getTokens(code: string) {
      if (!code) {
        throw new BadRequestException('Authorization code is required.');
      }
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      console.log('tokens:', tokens);
      if (!tokens){
          throw new BadRequestException('Failed to retrieve tokens from Google.');
      }
      const saveToken = await this.prisma.googleToken.create({
        data: {
          accessToken: tokens.access_token || 'undefined',
          refreshToken: tokens.refresh_token || 'undefined',
          scope: tokens.scope,
          tokenType: tokens.token_type,
          expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).getTime() : null,
        }
      })

      if (!saveToken) {
        throw new BadRequestException('Failed to save tokens to the database.');
      }
      return tokens;
    }


    async listFilesInFolder(folderId: string) {

        const tokens = await this.prisma.googleToken.findFirst({
          orderBy: { createdAt: 'desc' },
        });

        if (!tokens || !tokens.accessToken) {
          throw new BadRequestException('Google tokens not found. Please authenticate first.');
        }
    
        const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          params: {
            q: `'${folderId}' in parents`,
            fields: 'files(id,name,mimeType)',
          },
        });
    
        return res.data.files;
      }
    
      async downloadFile(fileId: string, destinationPath: string) {
        const tokens = await this.prisma.googleToken.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        
        if (!tokens || !tokens.accessToken) {
          throw new BadRequestException('Google tokens not found. Please authenticate first.');
        }
    
        const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          params: {
            alt: 'media',
          },
          responseType: 'stream',
        });
    
        return new Promise((resolve, reject) => {
          const dest = fs.createWriteStream(destinationPath);
          response.data
            .on('end', () => resolve(`File downloaded to ${destinationPath}`))
            .on('error', (err) => reject(`Error downloading file: ${err}`))
            .pipe(dest);
        });
      }



    /*
    async listFilesInFolder(folderId: string) {
        const tokens = loadGoogleTokens();
        if (!tokens) {
            throw new BadRequestException('Google tokens not found. Please authenticate first.');
        } 
        this.oauth2Client.setCredentials(tokens);

        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        const response = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'files(id, name, mimeType)',
        });

        return response.data.files;
    }

    async downloadFile(fileId: string, destinationPath: string) {
        const tokens = loadGoogleTokens();
        if (!tokens) {
            throw new BadRequestException('Google tokens not found. Please authenticate first.');
        } 
        this.oauth2Client.setCredentials(tokens);


        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        const response = await drive.files.get({
            fileId: fileId,
            alt: 'media',
        }, { responseType: 'stream' });

        console.log(response);

        return new Promise((resolve, reject) => {
            const dest = fs.createWriteStream(destinationPath);
            response.data
                .on('end', () => {
                    resolve(`File downloaded to ${destinationPath}`);
                })
                .on('error', (err) => {
                    reject(`Error downloading file: ${err}`);
                })
                .pipe(dest);
        });
    }
        */
}
