## Candidate Bio Summary

This document describes the AI-powered bio summarization feature for candidates. When a candidate's bio (generated during resume processing) exceeds a defined character threshold, the system automatically generates a concise summary and stores it in the `description_summary` field. This summary is intended for use in list views, cards, and any context where displaying the full bio is not practical.

---

### Requirements

- Environment variables:
  - `OPENAI_API_KEY`: API key for OpenAI (required to generate summaries)

- Database:
  - `Candidate.description_summary` field (`String?`) — added via migration `20260225123745_add_hire_request_description_summary`

---

### How It Works

The summary is generated automatically as part of the existing resume processing pipeline, inside `CandidatesService.processData()`.

**Trigger condition:** The bio returned by `extractDataFromResumeImages` must be longer than **300 characters**.

**Flow:**

```
PDF Resume
    ↓
Convert to images (Poppler)
    ↓
OpenAI: extractDataFromResumeImages()  →  organizedData.bio
    ↓
bio.length > 300 chars?
    ├── YES → openai.summarizeCandidateBio(bio)  →  bioSummary (1–2 sentences)
    └── NO  → bioSummary = null
    ↓
prisma.candidate.update({
  about_me: bio,               // full bio always saved
  description_summary: bioSummary,  // short summary or null
  ...
})
    ↓
processing_status: 'completed'
```

By the time the candidate status reaches `completed`, `description_summary` is already populated (or `null` if the bio was short or the OpenAI call failed non-critically).

---

### OpenAI Method

**Service:** `OpenaiService`
**Method:** `summarizeCandidateBio(bio: string): Promise<string>`

- **Model:** `gpt-4o-mini`
- **Temperature:** `0.3` (low — factual, consistent output)
- **Max tokens:** `100` (~1–2 sentences)
- **Output:** Plain text summary, no JSON, no markdown
- **Target length:** Under 200 characters

**Prompt behavior:**
- Writes in third person ("Experienced VA specializing in...", "Healthcare professional with...")
- Captures the candidate's primary specialization and key professional strength
- Omits names, contact details, and any PII

**Estimated cost per call:** ~$0.0001 (gpt-4o-mini pricing)

---

### Error Handling

Failure in `summarizeCandidateBio` does **not** interrupt the processing pipeline:

```typescript
try {
  bioSummary = await this.openai.summarizeCandidateBio(transformedData.bio);
} catch (err) {
  console.warn(`[candidate] Bio summary generation failed for candidate ${id}:`, err?.message || err);
  // description_summary remains null — processing continues normally
}
```

This means a candidate can reach `completed` status with `description_summary: null` if:
- The OpenAI API is unavailable or quota is exceeded
- The bio is 300 characters or fewer (no summary needed)

---

### Data Fields

| Field | Type | Description |
|---|---|---|
| `about_me` | `String?` | Full bio as returned by OpenAI — always saved |
| `description_summary` | `String?` | Short AI summary for list/card views — `null` if bio is short or generation failed |

---

### Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `description_summary String?` to `Candidate` model |
| `prisma/migrations/20260225123745_add_hire_request_description_summary/migration.sql` | Migration that creates the column |
| `src/openai/openai.service.ts` | Added `summarizeCandidateBio()` method |
| `src/candidate/candidates.service.ts` | Added summary generation logic inside `processData()` |
