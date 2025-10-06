import { BadRequestException, Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import insufficient_quota from '../common/utils/email-templates/insufficient_quota-openai';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpenaiService {
    constructor(
        private readonly mailService: MailService,
        private readonly prisma: PrismaService
    ) {}
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

        const prompt= `
        You are an information extraction assistant. 
        You will receive two inputs:
        1. Plain text from Amazon Textract (resume content).
        2. A object with existing candidate information from HubSpot.

        Your task is to return a JSON object in the EXACT structure defined below.
        You MUST NOT invent or guess information—use ONLY what is explicitly available in the Textract text or the HubSpot JSON. 
        If a field is missing, leave it empty or null as indicated.

        ---

        ### OUTPUT STRUCTURE (fixed)

        {
        "bio": "",
        "experience": [
            {
            "company": "",
            "role": "",
            "start_date": null,
            "end_date": null,
            "description": "",
            }
        ],
        "education": [
            {
            "institution": "",
            "degree": "",
            "start_date": null,
            "end_date": null,
            "description": ""
            }
        ],
        "cost": ""
        }

        ---
        

        ### CRITICAL RULES (HIGHEST PRIORITY)
        - NEVER include the candidate’s personal name, initials, or any direct identifier in the "bio".  
        - If a name appears in Textract or HubSpot, IGNORE it completely when writing the bio.  

        ### RULES
        #### General
        - Do not change the JSON structure or key order.
        - Extract only literal data found in Textract or HubSpot JSON.
        - If a field is not found, return it as "" (for strings), null (for numbers/dates), or [] (for arrays).
        - Do not invent or infer values. Only extract what is explicitly present in the input.
        - If a field is not applicable, leave it empty or null as specified.
        - If it is impossible to read a candidate data from hubspot, consider just the textract data.
        - Do not include the person's name on the bio.


        #### Bio / Summary
        - Do not include the person's name on the bio.
        - Write a brief description about the professional.
        - Write in a **client-oriented tone**, highlighting why the candidate is valuable to a potential employer.
        - Use **keywords** from the 'specializations' array in the HubSpot JSON.  
        - If relevant details exist in both Textract and HubSpot, combine them.
        - Only include facts actually present in the inputs; do not invent achievements or roles.
        - Length: 2–4 sentences, concise, professional.
        

        #### Experience
        - Use only literal data from Textract.
        - "description": MUST be composed of **sentence separated by semicolons (;) and each sentence MUST be between 100 and 120 characters.** Do not return shorter or longer sentences. 
        - Return only the JSON. No explanations or preamble.
        - On the start_date and end_date fields, return the date in the format YYYY-MM-DD.
        - if the date is not found, return null.
        - If the end_date is not found, return null.
        - if the start_date is not found, return null.
        - if is impossible get start_date and end_date, return null. never return 'Invalid Date'
        - Rewrite only for clarity and brevity if needed, but do not add information not present in Textract.  

        #### Education
        - Same as experience.

        #### Cost
        - Cost spend on OpenAi to process the request in USD.

        #### Ordering
        - Sort experience by most recent start_year (descending) if available; otherwise preserve source order.
        - Sort education chronologically by start_year if available.

        ---

        ### INPUTS
        Textract Resume Text:
        ----------------
        ${text}
        ----------------

        HubSpot Candidate JSON:
        ----------------
        ${candidateJSON}
        ----------------`
        try{
            const response = await openai.chat.completions.create({
                model: 'GPT-5-nano',
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
    
            const message = response.choices?.[0]?.message?.content;
    
            if (!message) {
            throw new BadRequestException('OpenAI did not return a valid message.');
            }
            return message;

        }catch (error: any) {
            
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
}
