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

/** Top-level keys defined by RESUME_EXTRACTION_PROMPT's schema. */
const RESUME_KEYS = ['bio', 'experience', 'education', 'skills'] as const;

const hasResumeKeys = (value: any): boolean =>
  !!value &&
  typeof value === 'object' &&
  RESUME_KEYS.some((key) => key in value);

/** Empty values must not win a merge, otherwise `[]` overwrites real data. */
const isEmptyValue = (value: any): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const toArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

/** Picks the first non-empty value, so aliases only fill genuine gaps. */
const firstNonEmpty = (...values: any[]): any =>
  values.find((value) => !isEmptyValue(value));

function normalizeExperienceItem(item: any): any {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    company: firstNonEmpty(item.company, item.employer, item.organization),
    role: firstNonEmpty(item.role, item.position, item.title, item.job_title),
    start_date:
      firstNonEmpty(item.start_date, item.startDate, item.from) ?? null,
    end_date: firstNonEmpty(item.end_date, item.endDate, item.to) ?? null,
    description: toArray(
      firstNonEmpty(item.description, item.responsibilities, item.details),
    ),
  };
}

function normalizeEducationItem(item: any): any {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    institution: firstNonEmpty(item.institution, item.school, item.university),
    degree: firstNonEmpty(item.degree, item.qualification, item.course),
    year: firstNonEmpty(item.year, item.graduation_date, item.date) ?? null,
  };
}

/**
 * Coerces a model response into the schema declared by
 * RESUME_EXTRACTION_PROMPT. Free models routinely violate that schema even with
 * `response_format: json_object` — the observed failure was a payload wrapped in
 * a "0" key alongside empty root-level `education`/`experience`, which read as a
 * complete but blank resume and wiped the candidate's stored data.
 *
 * Only reshapes: never invents values. Unrecoverable input yields `{}` so the
 * caller's empty-extraction guard can reject it.
 */
export function normalizeResumeExtraction(raw: any): any {
  // A model asked for one object sometimes returns a list of one.
  let root = Array.isArray(raw) ? raw[0] : raw;
  if (!root || typeof root !== 'object') return {};

  // Unwrap a container ({"0": {...}}, {"resume": {...}}) when the root itself
  // carries no schema keys but exactly one child does.
  if (!hasResumeKeys(root)) {
    const candidates = Object.values(root).filter(hasResumeKeys);
    if (candidates.length === 1) root = candidates[0];
  } else {
    // Root has schema keys but they may all be empty while a nested container
    // holds the real payload — the exact shape seen in production.
    const nested = Object.entries(root).filter(
      ([key, value]) =>
        !RESUME_KEYS.includes(key as any) && hasResumeKeys(value),
    );

    if (nested.length === 1) {
      const [wrapperKey, payload] = nested[0];
      // Root values only win when non-empty, so `education: []` cannot
      // overwrite a populated nested `education`. The wrapper key is skipped so
      // the payload isn't duplicated into the normalized result.
      const merged: Record<string, any> = { ...(payload as object) };
      for (const [key, value] of Object.entries(root)) {
        if (key !== wrapperKey && !isEmptyValue(value)) merged[key] = value;
      }
      root = merged;
    }
  }

  if (!root || typeof root !== 'object') return {};

  const bio = firstNonEmpty(
    root.bio,
    root.summary,
    root.about_me,
    root.professional_summary,
  );

  return {
    ...root,
    bio: typeof bio === 'string' ? bio : bio ? String(bio) : undefined,
    experience: toArray(root.experience).map(normalizeExperienceItem),
    education: toArray(root.education).map(normalizeEducationItem),
    skills: toArray(root.skills),
  };
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
