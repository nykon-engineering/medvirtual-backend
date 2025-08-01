import { BadRequestException, Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';

@Injectable()
export class OpenaiService {

    async organizeText(text: string): Promise<string> {
        
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new BadRequestException('OPENAI_API_KEY is not defined in environment variables');
        }
        const openai = new OpenAI({
            apiKey: apiKey
        });

        const prompt = `The text below is the content of a professional resume. Extract and organize the information in JSON format, with the following fields:

        - name: complet name
        - email: candidate email
        - phone: candidate phone number
        - bio: a brief description about the professional
        - education: array with { institution, degree, start_date, end_date }
        - experience: array with { company, role, start_date, end_date, description (organizated by bullet point and finalized with ;) } 
        - skills: array of the skills
        - languages: array of the languages spoken
        - specializations: array of the specializations

        Texto:
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
