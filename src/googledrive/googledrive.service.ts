import { Injectable } from '@nestjs/common';
import { google, Auth } from 'googleapis';
import * as fs from 'fs';

@Injectable()
export class GoogledriveService {
    private readonly oauth2Client: Auth.OAuth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENTE_ID,
            process.env.GOOGLE_CLIENTE_SECRET,
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
        return tokens;
    }

    getOAuthClient() {
        return this.oauth2Client;
    }

    async listFilesInFolder(folderId: string) {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        const response = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'files(id, name, mimeType)',
        });

        return response.data.files;
    }

    async downloadFile(fileId: string, destinationPath: string) {
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
