import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import https from 'https';

import { OAuth2Client } from 'google-auth-library';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogledriveService {
  private readonly oauth2Client: OAuth2Client;
  private readonly axiosInstance;

  constructor(private readonly prisma: PrismaService) {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    const agent = new https.Agent({ keepAlive: true });
    this.axiosInstance = axios.create({ httpsAgent: agent });
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.code === 'ETIMEDOUT',
    });
  }

  // => start with functions to generate the auth URL and get tokens
  generateAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/drive.readonly'];

    const url = this.oauth2Client.generateAuthUrl({
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

    if (!tokens) {
      throw new BadRequestException('Failed to retrieve tokens from Google.');
    }
    const saveToken = await this.prisma.googleToken.create({
      data: {
        accessToken: tokens.access_token || 'undefined',
        refreshToken: tokens.refresh_token || 'undefined',
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date).getTime()
          : null,
      },
    });

    if (!saveToken) {
      throw new BadRequestException('Failed to save tokens to the database.');
    }
    return tokens;
  }
  // => finish with functions to generate the auth URL and get tokens

  // => functions to refresh the access token and get a valid access token. These are used in the listFilesInFolder and downloadFile functions
  async refreshAccessToken(refreshToken: string) {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };
  }

  async getValidAccessToken() {
    const tokens = await this.prisma.googleToken.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!tokens || !tokens.accessToken || !tokens.expiryDate) {
      throw new BadRequestException(
        'Google tokens not found. Please authenticate first.',
      );
    }

    const now = Date.now();
    if (tokens?.expiryDate && now < Number(tokens.expiryDate) - 60 * 1000) {
      return tokens.accessToken;
    }

    const newTokens = await this.refreshAccessToken(tokens?.refreshToken || '');
    if (!newTokens || !newTokens.access_token)
      throw new BadRequestException('Failed to refresh access token.');

    await this.prisma.googleToken.update({
      where: { id: tokens.id },
      data: {
        accessToken: newTokens.access_token,
        expiryDate: newTokens.expiry_date
          ? new Date(newTokens.expiry_date).getTime()
          : null,
      },
    });

    return newTokens.access_token;
  }

  // => functions to help me in others internal functions
  async listFilesInFolder(folderId: string) {
    const tokens = await this.getValidAccessToken(); // Ensure we have a valid access token. if no, generate new accesToken with our refreshToken
    if (!tokens) {
      throw new BadRequestException(
        'Google tokens not found. Please authenticate first.',
      );
    }
    //console.log('tokens:', tokens);

    try {
      const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: {
          Authorization: `Bearer ${tokens}`,
        },
        params: {
          q: `'${folderId}' in parents`,
          fields: 'files(id,name,mimeType)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        },
      });
      return res.data.files;
    } catch (error) {
      throw new BadRequestException(
        `Failed to list files in folder: ${error.message}`,
      );
    }
  }

  async downloadFileOld(
    fileId: string,
    filename: string,
    downloadDir: string,
    id: string,
  ) {
    const tokens = await this.getValidAccessToken();
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&alt=media`;
    const headers = { Authorization: `Bearer ${tokens}` };
    let downloadUrl: string;

    try {
      const metadataResponse = await axios.get(metadataUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 15000, // 15s
      });
      if (metadataResponse.status !== 200) {
        return false;
      }
      const { mimeType } = metadataResponse.data;

      const exportableTypes = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/pdf',
      };

      if (exportableTypes[mimeType]) {
        const exportMimeType = exportableTypes[mimeType];
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
      } else {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      }

      const response: AxiosResponse<Buffer> = await axios.get(downloadUrl, {
        headers,
        responseType: 'arraybuffer',
        validateStatus: () => true, // Allow all status codes to be processed
      });

      if (response.status !== 200) {
        return false;
      }

      const destinationPath = path.resolve(downloadDir, filename);
      fs.writeFileSync(destinationPath, response.data);

      console.log(`Arquivo salvo em ${destinationPath}`);
      return true;
    } catch (error: any) {
      console.log(`Erro ao baixar o arquivo: ${error.message}`);
      return false;
    }
  }

  async downloadFile(
    fileId: string,
    filename: string,
    downloadDir: string,
    id: string,
  ) {
    const tokens = await this.getValidAccessToken();
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
    const headers = { Authorization: `Bearer ${tokens}` };
    let downloadUrl: string;

    try {
      const metadataResponse = await this.axiosInstance.get(metadataUrl, {
        headers,
        timeout: 120000,
      });

      if (metadataResponse.status !== 200) {
        console.log(`Failed to get metadata: ${metadataResponse.status}`);
        return false;
      }

      const { mimeType } = metadataResponse.data;

      const exportableTypes: Record<string, string> = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/pdf',
      };

      if (exportableTypes[mimeType]) {
        const exportMimeType = exportableTypes[mimeType];
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
      } else {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      }

      const response: AxiosResponse<Buffer> = await this.axiosInstance.get(
        downloadUrl,
        {
          headers,
          responseType: 'arraybuffer',
          timeout: 120000,
          validateStatus: () => true,
        },
      );

      if (response.status !== 200) {
        console.error(`Failed to download file: ${response.status}`);
        return false;
      }

      const destinationPath = path.resolve(downloadDir, filename);
      fs.writeFileSync(destinationPath, response.data);

      console.log(`Failed save on ${destinationPath}`);
      return true;
    } catch (error: any) {
      console.error(`Failed on the google drive: ${error.message}`);
      return false;
    }
  }
}
