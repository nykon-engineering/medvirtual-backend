
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib'; // User needs: npm install pdf-lib
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: npx ts-node -r tsconfig-paths/register scripts/test-resume-vision.ts <path-to-pdf>');
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const tempDir = path.join(__dirname, 'temp_pages');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    try {
        console.log(`\n1. Splitting PDF using pdf-lib (Pure JS)...`);
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const pageCount = pdfDoc.getPageCount();
        const pagesToConvert = Math.min(pageCount, 2); // First 2 pages max
        const imagePaths: string[] = [];

        console.log(`   Processing ${pagesToConvert} pages...`);

        for (let i = 0; i < pagesToConvert; i++) {
            // Create a new document for this single page
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
            newPdf.addPage(copiedPage);
            const pdfBytes = await newPdf.save();

            const tempPdfPath = path.join(tempDir, `page_${i + 1}.pdf`);
            const tempImgPath = path.join(tempDir, `page_${i + 1}.png`);

            fs.writeFileSync(tempPdfPath, pdfBytes);

            // Use MacOS native 'sips' tool to convert to PNG
            // sips -s format png input.pdf --out output.png
            console.log(`   Converting Page ${i + 1} with sips...`);
            try {
                await execAsync(`sips -s format png "${tempPdfPath}" --out "${tempImgPath}"`);
                imagePaths.push(tempImgPath);
            } catch (err) {
                console.error(`   Error converting page ${i + 1}: ${err.message}`);
            }
        }

        if (imagePaths.length === 0) {
            throw new Error('No images converted.');
        }

        console.log(`\n2. Sending ${imagePaths.length} images to OpenAI (gpt-4o-mini)...`);

        const contentPayload: any[] = [
            {
                type: "text",
                text: `You are a resume parser. Extract the following information into a strictly valid JSON object.
            
            JSON Schema:
            {
                "bio": "string (summary)",
                "experience": [{ "company": "", "role": "", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "description": "" }],
                "education": [{ "institution": "", "degree": "", "year": "" }],
                "skills": ["string"]
            }

            - Do not invent information.
            - If dates are "Present", use null for end_date.
            - Summarize the bio based on the visible text.
            `
            }
        ];

        for (const imgPath of imagePaths) {
            const fileData = fs.readFileSync(imgPath);
            const b64 = fileData.toString('base64');
            contentPayload.push({
                type: "image_url",
                image_url: {
                    url: `data:image/png;base64,${b64}`,
                    detail: "high"
                }
            });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: contentPayload
                }
            ],
            max_tokens: 2000,
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const result = response.choices[0].message.content;

        console.log(`\n\n--- PARSED RESULT ---\n`);
        console.log(result);

        const parsed = JSON.parse(result || '{}');
        console.log(`\n[SUCCESS] Parsed ${parsed.experience?.length || 0} experience items.`);

    } catch (error) {
        console.error('\n[FATAL ERROR]', error);
    } finally {
        // Cleanup
        console.log('\nCleaning up temp files...');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

run();
