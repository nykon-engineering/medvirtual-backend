import { Injectable } from '@nestjs/common';

import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";
import * as fs from 'fs'

@Injectable()
export class TextractService {

    async readDocument (file: string): Promise<any> {
        console.log("Reading document:", file);
        const client = new TextractClient({ region: 'us-east-1' });
        const fileBytes = fs.readFileSync('src/textract/sample.pdf');

        const command = new AnalyzeDocumentCommand({
            Document: {
                Bytes: fileBytes
            },
            FeatureTypes: ['TABLES', 'FORMS']
        });

        try {
            const response = await client.send(command);
            console.log("Document analyzed successfully:", response);
            return response;
        } catch (error) {
            console.error("Error analyzing document:", error);
            throw new Error("Failed to analyze document");
        }

    }
}
