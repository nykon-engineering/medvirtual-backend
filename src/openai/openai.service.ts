import { BadRequestException, Injectable } from '@nestjs/common';
import fs from "fs";
import OpenAI, { toFile } from "openai";
import insufficient_quota from '../common/utils/email-templates/insufficient_quota-openai';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import path from 'path';

import { File as NodeFile } from "node:buffer";
if (!globalThis.File) {
    globalThis.File = NodeFile as unknown as typeof File;
}

@Injectable()
export class OpenaiService {
    constructor(
        private readonly mailService: MailService,
        private readonly prisma: PrismaService
    ) { }
    /* istanbul ignore next */




    async organizeText(text: string, candidate: any): Promise<string> {

        const candidateJSON = JSON.stringify(candidate);

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new BadRequestException('OPENAI_API_KEY is not defined in environment variables');
        }
        const openai = new OpenAI({
            apiKey: apiKey
        });

        const prompt = `
        You are a resume data extraction assistant.

        Your job is to read:
        1. Plain text extracted by Amazon Textract (resume content)
        2. A JSON object with candidate info

        and return a **single valid JSON object** with the exact structure below.

        ---

        ### OUTPUT SCHEMA (DO NOT CHANGE KEYS OR ORDER)
        {
        "bio": "",
        "experience": [
            {
            "company": "",
            "role": "",
            "start_date": null,
            "end_date": null,
            "description": ""
            }
        ],
        "education": [
            {
            "institution": "",
            "degree": "",
            "start_date": null,
            "end_date": null,
            "description": []
            }
        ]
        }

        ---

        ### CRITICAL RULES
        - Return ONLY valid JSON. No markdown, no explanations, no comments.
        - If a value is unknown, return "" or null (do not invent facts).
        - Never include personal names or identifiers in the "bio".
        - All dates must be ISO format (YYYY-MM-DD) or null.
        - Each "experience.description" must be:
            - Array of strings, each string a single sentence.
            - Each sentence between 100 and 120 characters.
            - If needed, use bullet points (•) to separate different responsibilities or achievements.
            - Each sentence need to have at least 100 characters.Don't return short than 100 characters.
            - If the description is too short, expand it with relevant details based on the role and industry.
        - Use the filler phrases only when needed to reach 100 characters:
            - "demonstrating strong attention to detail and adherence to quality standards"
            - "ensuring compliance with regulations and maintaining accurate documentation"
            - "coordinating with teams to optimize outcomes and workflow continuity"
            - "providing training and support to improve performance"
        - Do not create new companies, degrees, or dates. Use only information from the inputs.

        ---

        ### BIO
        - Do not include the person's name on the bio.
        - Write a brief description about the professional.
        - Write in a **client-oriented tone**, highlighting why the candidate is valuable to a potential employer.
        - Write 2–4 sentences (without the candidate’s name) summarizing professional background.
        - You may combine or paraphrase facts from Textract and HubSpot.
        - Use **keywords** from the 'specializations' array in the HubSpot JSON. 
        - If relevant details exist in both Textract and HubSpot, combine them.
        - Only include facts actually present in the inputs; do not invent achievements or roles.
        - Length: 2–4 sentences, concise, professional.


        ---

        ### ORDERING
        - Sort experience by most recent start_date.
        - Sort education by chronological order.

        ---

        ### INPUT DATA

        **Textract Resume Text:**
        ${text}

        **HubSpot Candidate JSON:**
        ${candidateJSON}

        ---

        ### FINAL INSTRUCTION
        Return only a **single valid JSON object** that passes strict JSON.parse().
        `;


        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a resume data extractor. return only the JSON request',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.2,
            });
            const usage = response.usage;
            let cost = 0;
            if (usage) {
                const inputCost = (usage.prompt_tokens / 1000) * 0.0020;
                const outputCost = (usage.completion_tokens / 1000) * 0.0060;
                cost = inputCost + outputCost;
            }

            let message: any = response.choices?.[0]?.message?.content;
            if (!message) {
                throw new BadRequestException('OpenAI did not return a valid message.');
            }

            let parsedMessage;

            try {
                parsedMessage = JSON.parse(message);
            } catch (e) {
                console.error('Erro ao converter resposta JSON da OpenAI:', e);
                throw new BadRequestException('Invalid JSON returned from OpenAI');
            }
            parsedMessage.cost = `$${cost.toFixed(4)}`;
            message = JSON.stringify(parsedMessage, null, 2);

            return message;

        } catch (error: any) {

            if (error?.type === 'insufficient_quota') {
                console.error('[OpenAI] Insufficient Quota:');

                const today = new Date();
                const existingMail = await this.prisma.mail_Settings.findFirst({
                    where: {
                        title: 'insufficient_quota',
                        created_at: {
                            gte: new Date(today.setHours(0, 0, 0, 0)),
                            lt: new Date(today.setHours(23, 59, 59, 999)),
                        },
                    },
                });
                if (!existingMail) {
                    // Send insufficient quota via email
                    const emailBody = insufficient_quota();
                    const mailSent = await this.mailService.sendMail({
                        from: 'MedVirtual <noreply@medvirtual.ai>',
                        to: 'shayan@regenta.ai',
                        cc: 'paulo@regenta.ai',
                        subject: 'Insufficient Quota from OpenAI',
                        html: emailBody,
                    });
                    if (!mailSent) {
                        console.log('Failed to send insufficient quota email notification.');
                    }
                    //Here I save in the database that I sent the email
                    await this.prisma.mail_Settings.create({
                        data: {
                            title: 'insufficient_quota',
                        },
                    });
                }



                throw new BadRequestException('You dont have credits. Check your plan/billing.');
            }

            if (error?.type === 'rate_limit_error') {
                console.log('[OpenAI] Rate Limit Exceeded:');
                throw new BadRequestException('Rate limit exceeded. Please try again later.');
            }

            console.log('[OpenAI] unexpected error:', error);
            throw new BadRequestException('unexpected error to request OpenAI.', error);
        }

    }

    async generateAvatarWithScreenshoot(candidate: any, imageDownloaded: any): Promise<any> {

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = `
        Generate a realistic professional avatar inspired by the person in the reference image.
        Keep a similar lighting setup (soft studio light) and neutral background, but without accessories like headphone.
        Style: modern corporate headshot, natural facial expression, confident and friendly.
        Avoid copying the person — just use the image as reference for lighting and style.
        The avatar result need to be on format 1024x1024 pixels.
        `;

        const image = fs.createReadStream(imageDownloaded);

        const result = await openai.images.edit({
            model: "gpt-image-1",
            image: await toFile(image, null, {
                type: "image/png",
            }),
            //mask: await toFile(fs.createReadStream("mask.png"), null, {
            //    type: "image/png",
            //}),
            prompt,
        });

        //=> calculate the cost


        if (!result.data || !result.data[0] || !result.data[0].b64_json) {
            throw new Error("A resposta da API OpenAI não contém os dados esperados.");
        }
        const imageBase64 = result.data[0].b64_json;
        const fileName = `${Date.now()}_avatarX.png`;
        const outputPath = path.resolve('/tmp', fileName);
        console.log('Output path for avatar:', outputPath);
        fs.writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));

        return outputPath;
    }


    async extractDataFromResumeImages(imagePaths: string[]): Promise<any> {
        const apiKey = process.env.OPENAI_API_KEY_RESUME_EXTRACTION || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new BadRequestException('OPENAI_API_KEY is not defined in environment variables');
        }
        const openai = new OpenAI({
            apiKey: apiKey
        });

        const contentPayload: any[] = [
            {
                type: "text",
                text: `You are a resume parser. Extract the following information into a strictly valid JSON object.
            
            JSON Schema:
            {
                "bio": "string (summary)",
                "experience": [{ "company": "", "role": "", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "description": ["string"] }],
                "education": [{ "institution": "", "degree": "", "year": "YYYY-MM-DD" }],
                "skills": ["string"]
            }

            - Do not invent information.
            - If dates are "Present", use null for end_date.
            - If dates are in "Month Year" format (e.g. "Mar 2025"), convert them to "YYYY-MM-01".
            - Summarize the bio based on the visible text.
            - Ensure "experience.description" is an array of strings (sentences).
            - For education, extract the graduation date. If only year is available, use "YYYY-01-01".
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

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4.1-nano",
                messages: [
                    {
                        role: "user",
                        content: contentPayload
                    }
                ],
                max_tokens: 4500,
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const result = response.choices[0].message.content;
            return JSON.parse(result || '{}');

        } catch (error: any) {

            if (error?.type === 'insufficient_quota') {
                console.error('[OpenAI] Insufficient Quota:');

                const today = new Date();
                const existingMail = await this.prisma.mail_Settings.findFirst({
                    where: {
                        title: 'insufficient_quota',
                        created_at: {
                            gte: new Date(today.setHours(0, 0, 0, 0)),
                            lt: new Date(today.setHours(23, 59, 59, 999)),
                        },
                    },
                });
                if (!existingMail) {
                    // Send insufficient quota via email
                    const emailBody = insufficient_quota();
                    const mailSent = await this.mailService.sendMail({
                        from: 'MedVirtual <noreply@medvirtual.ai>',
                        to: 'shayan@regenta.ai',
                        cc: 'paulo@regenta.ai',
                        subject: 'Insufficient Quota from OpenAI',
                        html: emailBody,
                    });
                    if (!mailSent) {
                        console.log('Failed to send insufficient quota email notification.');
                    }
                    //Here I save in the database that I sent the email
                    await this.prisma.mail_Settings.create({
                        data: {
                            title: 'insufficient_quota',
                        },
                    });
                }

                throw new BadRequestException('You dont have credits. Check your plan/billing.');
            }

            if (error?.type === 'rate_limit_error') {
                console.log('[OpenAI] Rate Limit Exceeded:');
                throw new BadRequestException('Rate limit exceeded. Please try again later.');
            }

            console.error('Error in extractDataFromResumeImages:', error);
            throw new BadRequestException('Failed to extract data from resume images');
        }
    }


}
