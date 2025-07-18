import { BadRequestException, Injectable } from '@nestjs/common';
import { google, Auth } from 'googleapis';
import * as fs from 'fs';

import { loadGoogleTokens } from './loadgoogletokens';

@Injectable()
export class GoogledriveService {
    private readonly oauth2Client: Auth.OAuth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
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

        console.log('Authorize this app by visiting this url:', url);
        return url;
    }

    async getTokens(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        fs.writeFileSync(`${process.env.GOOGLE_FILE_TOKENS}`, JSON.stringify(tokens)); //here I'll save this tokens to a file for later use
        return tokens;
    }


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
}
