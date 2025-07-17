import { Controller, Get, Param } from '@nestjs/common';
import { GoogleService} from './googledrive.service';

@Controller('googledrive')
export class GoogledriveController {
    constructor(
        private readonly googleService: GoogleService
    ){}

    @Get('/list-files/:folderId')
    async listFilesInFolder(folderId: string) {
        return this.googleService.listFilesInFolder(folderId);
    }

    @Get('download-file/:fileId')
    async downloadFile(@Param('fileId') fileId: string) {
        const destinationPath = `./downloads-resume/`;
        return this.googleService.downloadFile(fileId, destinationPath);
    }

}


