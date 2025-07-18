import { Controller, Get, Param } from '@nestjs/common';
import { GoogledriveService } from './googledrive.service';

@Controller('googledrive')
export class GoogledriveController {
    constructor(
        private readonly googledriveService : GoogledriveService
    ){}

    @Get('/list-files/:folderId')
    async listFilesInFolder(folderId: string) {
        return this.googledriveService.listFilesInFolder(folderId);
    }

    @Get('download-file/:fileId')
    async downloadFile(@Param('fileId') fileId: string) {
        const destinationPath = `./downloads-resume/`;
        return this.googledriveService.downloadFile(fileId, destinationPath);
    }

}


