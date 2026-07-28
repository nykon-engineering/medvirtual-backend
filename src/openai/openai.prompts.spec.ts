import { normalizeResumeExtraction } from './openai.prompts';

/**
 * Mirrors the payload a free model actually returned in production: the real
 * resume nested under a "0" key, with empty root-level education/experience.
 * Downstream read that as a complete-but-blank resume and wiped the candidate.
 */
const wrappedPayload = () => ({
  '0': {
    bio: 'Detail-oriented and compassionate Customer Support Specialist.',
    skills: ['Inbound & Outbound Call Handling', 'HIPAA Compliance', 'Notion'],
    education: [
      {
        year: '2024-08-01',
        degree: 'Bachelor of Science in Human resource Management',
        institution: 'Institute of Creative Computer Technology (ICCT)',
      },
    ],
    experience: Array.from({ length: 15 }, (_, i) => ({
      role: `Role ${i + 1}`,
      company: `Company ${i + 1}`,
      end_date: '2026-07-01',
      start_date: '2025-01-01',
      description: [`desc ${i + 1}`],
    })),
  },
  education: [],
  experience: [],
});

describe('normalizeResumeExtraction', () => {
  describe('the production failure: payload wrapped in a "0" key', () => {
    it('should recover the nested resume', () => {
      const result = normalizeResumeExtraction(wrappedPayload());

      expect(result.bio).toContain('Detail-oriented');
      expect(result.experience).toHaveLength(15);
      expect(result.education).toHaveLength(1);
      expect(result.skills.length).toBeGreaterThan(0);
    });

    it('should not let the empty root education overwrite the nested one', () => {
      const result = normalizeResumeExtraction(wrappedPayload());

      expect(result.education[0].institution).toBe(
        'Institute of Creative Computer Technology (ICCT)',
      );
      expect(result.experience[0].company).toBe('Company 1');
    });

    it('should drop the wrapper key from the result', () => {
      expect(normalizeResumeExtraction(wrappedPayload())['0']).toBeUndefined();
    });
  });

  describe('other container shapes', () => {
    it('should unwrap a named container', () => {
      const result = normalizeResumeExtraction({
        resume: { bio: 'A bio', experience: [{ company: 'X' }] },
      });

      expect(result.bio).toBe('A bio');
      expect(result.experience).toHaveLength(1);
    });

    it('should flatten a single-element array', () => {
      const result = normalizeResumeExtraction([
        { bio: 'A bio', skills: ['x'] },
      ]);

      expect(result.bio).toBe('A bio');
      expect(result.skills).toEqual(['x']);
    });

    it('should keep non-empty root values when unwrapping', () => {
      const result = normalizeResumeExtraction({
        bio: 'Root bio wins',
        experience: [],
        nested: { bio: 'Nested bio', experience: [{ company: 'X' }] },
      });

      expect(result.bio).toBe('Root bio wins');
      expect(result.experience).toHaveLength(1);
    });
  });

  describe('already-valid input', () => {
    it('should preserve a well-formed OpenAI response', () => {
      const openaiShape = {
        bio: 'A professional summary.',
        experience: [
          {
            company: 'Acme',
            role: 'Nurse',
            start_date: '2020-01-01',
            end_date: null,
            description: ['Did things'],
          },
        ],
        education: [{ institution: 'MIT', degree: 'BS', year: '2019-01-01' }],
        skills: ['Triage'],
      };

      const result = normalizeResumeExtraction(openaiShape);

      expect(result.bio).toBe(openaiShape.bio);
      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].company).toBe('Acme');
      expect(result.experience[0].description).toEqual(['Did things']);
      expect(result.education[0].institution).toBe('MIT');
      expect(result.skills).toEqual(['Triage']);
    });
  });

  describe('type coercion', () => {
    it('should wrap single items into arrays', () => {
      const result = normalizeResumeExtraction({
        bio: 'x',
        experience: { company: 'Solo' },
        skills: 'Typing',
      });

      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].company).toBe('Solo');
      expect(result.skills).toEqual(['Typing']);
    });

    it('should default missing collections to empty arrays', () => {
      const result = normalizeResumeExtraction({ bio: 'only a bio' });

      expect(result.experience).toEqual([]);
      expect(result.education).toEqual([]);
      expect(result.skills).toEqual([]);
    });

    it('should turn a string description into an array', () => {
      const result = normalizeResumeExtraction({
        experience: [{ company: 'X', description: 'One line' }],
      });

      expect(result.experience[0].description).toEqual(['One line']);
    });
  });

  describe('field aliases', () => {
    it('should map alternate field names onto the schema', () => {
      const result = normalizeResumeExtraction({
        summary: 'Bio under an alias',
        experience: [{ employer: 'Acme', position: 'Nurse' }],
        education: [{ school: 'MIT', qualification: 'BS' }],
      });

      expect(result.bio).toBe('Bio under an alias');
      expect(result.experience[0].company).toBe('Acme');
      expect(result.experience[0].role).toBe('Nurse');
      expect(result.education[0].institution).toBe('MIT');
      expect(result.education[0].degree).toBe('BS');
    });

    it('should prefer the canonical field over an alias', () => {
      const result = normalizeResumeExtraction({
        bio: 'Canonical',
        summary: 'Alias',
        experience: [{ company: 'Real', employer: 'Alias' }],
      });

      expect(result.bio).toBe('Canonical');
      expect(result.experience[0].company).toBe('Real');
    });
  });

  describe('unrecoverable input', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a string', 'not an object'],
      ['an empty array', []],
    ])('should return an empty object for %s', (_label, input) => {
      expect(normalizeResumeExtraction(input)).toEqual({});
    });

    it('should return empty collections for an empty object', () => {
      const result = normalizeResumeExtraction({});

      expect(result.bio).toBeUndefined();
      expect(result.experience).toEqual([]);
    });
  });
});
