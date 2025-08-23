import { Body, Controller, Headers, HttpException, HttpStatus, Post } from '@nestjs/common';
import { GooglesheetService } from './googlesheet.service';

@Controller('googlesheet')
export class GooglesheetController {
    constructor(private readonly googleSheetsService: GooglesheetService) {}

    @Post('webhook')
    async handleWebhook(
        @Headers('x-webhook-secret') secret: string,
        @Headers('x-event-id') eventId: string,
        @Body() body: any,
    ) {
        // 1) secret from headers
        if (secret !== process.env.SHEETS_WEBHOOK_SECRET) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        // 2) Idempotency
        const already = await this.googleSheetsService.isDuplicate(eventId);
        if (already) {
        return { ok: true, duplicated: true };
        }
        
        console.log('Received dadas from Google sheet:', { secret, eventId, body });
        console.log('Values:', body?.values);
        body.values.map((row: any) => {
            console.log('Row:', row);
        })
 


        // 3) basic verification
        if (!body?.spreadsheetId || !body?.sheetName || !body?.eventType) {
        throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
        }

        // 4) call the process
        await this.googleSheetsService.processEvent(eventId, body);
        return { ok: true };
    }
}
