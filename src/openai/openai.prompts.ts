import fs from 'fs';
import { OpenRouterContentPart } from '../openrouter/openrouter.types';

export const RESUME_EXTRACTION_PROMPT = `You are a professional resume parser. Your goal is to extract **100% of the information** from the resume images provided.

            ### JSON Schema
            Return a single valid JSON object. Do not wrap in markdown code blocks.
            {
                "bio": "string (professional summary, 3-5 sentences highlighting key skills and value)",
                "experience": [
                    {
                        "company": "string",
                        "role": "string",
                        "start_date": "YYYY-MM-DD (or null)",
                        "end_date": "YYYY-MM-DD (or null)",
                        "description": ["string (full sentence)"]
                    }
                ],
                "education": [
                    {
                        "institution": "string",
                        "degree": "string",
                        "year": "YYYY-MM-DD (graduation date or latest date)"
                    }
                ],
                "skills": ["string"]
            }

            ### Extraction Rules
            1. **EXTRACT ALL DATA**: Do not summarize or select "top" roles. Extract **EVERY** single experience and education entry visible on the resume.
            2. **Experience Descriptions**:
               - Capture the full richness of the role.
               - Each distinct responsibility or achievement should be a separate string in the "description" array.
               - Do not truncate sentences.
            3. **Dates**:
               - Format: "YYYY-MM-DD".
               - "Present", "Current", "Now" -> null for end_date.
               - "Jan 2020" -> "2020-01-01".
               - "2020" -> "2020-01-01".
               - If only a year is given for education, use "YYYY-01-01".
            4. **Bio**:
               - Synthesize a strong professional profile based on the visible text.
               - Do not include the candidate's name or contact info in the bio.
            `;

export const TEXT_SUMMARY_SYSTEM_PROMPT =
  'You are a professional content summarizer. Return only plain text.';

export function buildTextSummaryPrompt(text: string): string {
  return `
        You are a professional content summarizer for a medical staffing platform.
        Summarize the following hire request description in up to 3 clear, concise sentences.
        Focus on the role, key responsibilities, and main requirements.
        Do not include personal or patient information.
        Return ONLY the summary text, no JSON, no markdown, no extra formatting.

        Description:
        ${text}
        `;
}

/**
 * Builds the multimodal payload for resume extraction. Shared by OpenaiService
 * and the comparison endpoint so both providers receive byte-identical input —
 * that equivalence is what makes the side-by-side comparison meaningful.
 */
export function buildResumeExtractionPayload(
  imagePaths: string[],
): OpenRouterContentPart[] {
  const contentPayload: OpenRouterContentPart[] = [
    { type: 'text', text: RESUME_EXTRACTION_PROMPT },
  ];

  for (const imgPath of imagePaths) {
    const fileData = fs.readFileSync(imgPath);
    const b64 = fileData.toString('base64');
    contentPayload.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${b64}`,
        detail: 'high',
      },
    });
  }

  return contentPayload;
}
