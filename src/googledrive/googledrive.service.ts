import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogledriveService {
  private readonly oauth2Client: OAuth2Client;

  constructor(private readonly prisma: PrismaService) {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  generateAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  async getTokens(code: string) {
    if (!code) throw new BadRequestException('Authorization code is required.');
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    if (!tokens) throw new BadRequestException('Failed to retrieve tokens from Google.');

    const saved = await this.prisma.googleToken.create({
      data: {
        accessToken: tokens.access_token || 'undefined',
        refreshToken: tokens.refresh_token || 'undefined',
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).getTime() : null,
      },
    });

    if (!saved) throw new BadRequestException('Failed to save tokens to the database.');
    return tokens;
  }

  async refreshAccessToken(refreshToken: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };
  }

  async getValidAccessToken(): Promise<string> {
    const token = await this.prisma.googleToken.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!token || !token.accessToken || !token.expiryDate)
      throw new BadRequestException('Google tokens not found. Please authenticate first.');

    const now = Date.now();
    if (now < Number(token.expiryDate) - 60 * 1000) return token.accessToken;

    const newTokens = await this.refreshAccessToken(token.refreshToken || '');
    if (!newTokens || !newTokens.access_token)
      throw new BadRequestException('Failed to refresh access token.');

    await this.prisma.googleToken.update({
      where: { id: token.id },
      data: {
        accessToken: newTokens.access_token,
        expiryDate: newTokens.expiry_date ? new Date(newTokens.expiry_date).getTime() : null,
      },
    });

    return newTokens.access_token;
  }


  async listFilesInFolder(folderId: string) {
    const accessToken = await this.getValidAccessToken();
    this.oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id,name,mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return res.data.files;
    } catch (error: any) {
      throw new BadRequestException(`Failed to list files in folder: ${error.message}`);
    }
  }


  async downloadFile(fileId: string, filename: string, downloadDir: string) {
    const accessToken = await this.getValidAccessToken();
    this.oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    try {

      const { data: metadata } = await drive.files.get({
        fileId,
        fields: 'name,mimeType',
        supportsAllDrives: true,
      });

      const destPath = path.resolve(downloadDir, filename);
      const exportableTypes: Record<string, string> = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/pdf',
      };


      if (exportableTypes[metadata.mimeType!]) {
        const mimeType = exportableTypes[metadata.mimeType!];
        const dest = fs.createWriteStream(destPath);

        await drive.files.export(
          { fileId,
            mimeType,
          },
          { responseType: 'stream' },
          (err, res: any) => {
            if (err) throw err;
            res.data
              .on('end', () => console.log(`Arquivo salvo em ${destPath}`))
              .on('error', (err: any) => console.error('Erro no stream:', err))
              .pipe(dest);
          },
        );
      } else {

        const dest = fs.createWriteStream(destPath);
        const res = await drive.files.get({
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        }, { responseType: 'stream' });

        await new Promise<void>((resolve, reject) => {
          res.data
            .on('end', () => {
              console.log(`Arquivo salvo em ${destPath}`);
              resolve();
            })
            .on('error', (err: any) => reject(err))
            .pipe(dest);
        });
      }

      //return true;
      return 'Download successful';
    } catch (error: any) {
      
      console.log(`Failed to download file: ${error.message}`, `Code: ${error.code}`);
      return error.message;
      //return false;
    }
  }

  async downloadImage(fileId: string, filename: string, downloadDir: string) {
    const accessToken = await this.getValidAccessToken();
    this.oauth2Client.setCredentials({ access_token: accessToken });
  
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  
    try {
      
      const { data: metadata } = await drive.files.get({
        fileId,
        fields: 'name,mimeType',
        supportsAllDrives: true,
      });
      
      const destPath = path.resolve(downloadDir, filename);    

      const dest = fs.createWriteStream(destPath);
      
      const exportableTypes: Record<string, string> = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/pdf',
      };
  
      if (exportableTypes[metadata.mimeType!]) {
       
        const mimeType = exportableTypes[metadata.mimeType!];
        //const dest = fs.createWriteStream(destPath);
  
        await new Promise<void>((resolve, reject) => {
          drive.files.export(
            { fileId, mimeType },
            { responseType: 'stream' },
            (err, res: any) => {
              if (err) return reject(err);
              res.data
                .on('end', () => {
                  console.log(`Arquivo exportado com sucesso em ${destPath}`);
                  resolve();
                })
                .on('error', (err: any) => reject(err))
                .pipe(dest);
            }
          );
        });
  
      } else {
        //const dest = fs.createWriteStream(destPath);
  
        const res = await drive.files.get(
          {
            fileId,
            alt: 'media',
            supportsAllDrives: true,
          },
          { responseType: 'stream' }
        );
  
        await new Promise<void>((resolve, reject) => {
          res.data
            .on('end', () => {
              console.log(`Arquivo salvo com sucesso em ${destPath}`);
              resolve();
            })
            .on('error', (err: any) => reject(err))
            .pipe(dest);
        });
      }
  
      return destPath; // return the complet path
    } catch (error: any) {
      console.error(`Falha ao baixar arquivo: ${error.message}`, `Code: ${error.code}`);
      throw new Error(error.message);
    }
  }
  
}
