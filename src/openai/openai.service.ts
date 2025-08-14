import { BadRequestException, Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';

@Injectable()
export class OpenaiService {

    /* istanbul ignore next */
    async organizeText(text: string): Promise<string> {
        
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new BadRequestException('OPENAI_API_KEY is not defined in environment variables');
        }
        const openai = new OpenAI({
            apiKey: apiKey
        });

        const prompt = `You are a backend system assistant. Your task is to extract structured candidate data from resumes.
        Below is the plain text extracted from a candidate's resume using Amazon Textract.
        You must return a JSON object that follows EXACTLY the schema described below. DO NOT guess or infer any information that is not explicitly stated in the input text.
        If a field is not found in the text, return it as null, an empty array, or an empty string, as appropriate based on the data type.  

        - name: complet name
        - email: candidate email
        - phone: candidate phone number
        - bio: a brief description about the professional
        - education: array with { institution, degree, start_date, end_date }
        - experience: array with { company, role, start_date, end_date, description (organizated text with each phrase finalized with ;) } 
        - years_of_experience: number of years of experience calculating the difference between the earliest start date and the current year
        - specializations: array of the specializations

        Rules:
        - Do not change the structure of the JSON.
        - Do not invent or infer values. Only extract what is explicitly present in the input.
        - If a field is not found, leave it as null, empty string "", or [] depending on the field type.
        - The outer structure and keys must always be the same.
        - Return only the JSON. No explanations or preamble.
        - On the start_date and end_date fields, return the date in the format YYYY-MM-DD.
        - if the date is not found, return null.
        - If the end_date is not found, return null.
        - if the start_date is not found, return null.
        - if is impossible get start_date and end_date, return null. never return 'Invalid Date'

        Text:
        """ 
        ${text}
        """
        `;

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
