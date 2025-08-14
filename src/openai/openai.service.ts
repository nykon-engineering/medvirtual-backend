import { BadRequestException, Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';

@Injectable()
export class OpenaiService {

    /* istanbul ignore next */
    async organizeText(text: string, candidate: any): Promise<string> {
        
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
        "bio": ,
        "experience": [
            {
            "company": "",
            "role": "",
            "start_date": null,
            "end_date": null,
            "description": "" ,
            }
        ],
        "education": [
            {
            "institution": "",
            "degree": "",
            "start_date": null,
            "end_date": null,
            "description": "",
            }
        ]
        }

        ---
        ### RULES

        #### General
        - Do not change the JSON structure or key order.
        - Extract only literal data found in Textract or HubSpot JSON.
        - If a field is not found, return it as "" (for strings), null (for numbers/dates), or [] (for arrays).
        - Do not invent or infer values. Only extract what is explicitly present in the input.
        - If a field is not applicable, leave it empty or null as specified.
        - If it is impossible to read a candidate data from hubspot, consider just the textract data.


        #### Bio / Summary
        - Write a brief description about the professional.
        - Write in a **client-oriented tone**, highlighting why the candidate is valuable to a potential employer.
        - Use **keywords** from the 'specializations' array in the HubSpot JSON.  
        - If relevant details exist in both Textract and HubSpot, combine them.
        - Only include facts actually present in the inputs; do not invent achievements or roles.
        - Length: 2–4 sentences, concise, professional.

        #### Experience
        - Use only literal data from Textract.
        - 'description': short paragraph summarizing the role. organizated text with each phrase finalized with ;.
        - Return only the JSON. No explanations or preamble.
        - On the start_date and end_date fields, return the date in the format YYYY-MM-DD.
        - if the date is not found, return null.
        - If the end_date is not found, return null.
        - if the start_date is not found, return null.
        - if is impossible get start_date and end_date, return null. never return 'Invalid Date'
        - Rewrite only for clarity and brevity if needed, but do not add information not present in Textract.  

        #### Education
        - Same as experience.

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
        ${candidate}
        ----------------`

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
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
    }
}
