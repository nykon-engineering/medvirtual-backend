# VA Score Card Fields — HubSpot → Platform Sync

**Date:** 2026-02-23
**Migration:** `20260223164133_include_fields_from_va_score`

## Objective

Add all **VA Score Card** fields from HubSpot to the database, enabling one-way data synchronization: **HubSpot → Platform**.

These fields are not editable through the platform. HubSpot is always the source of truth; the database stores a local copy to facilitate queries and display.

---

## Changed Files

| File | Change Type |
|---|---|
| `prisma/schema.prisma` | 34 new fields added to the `Candidate` model |
| `prisma/migrations/20260223164133_include_fields_from_va_score/migration.sql` | SQL migration with `ALTER TABLE` statements |
| `src/common/dictionaries/candidate-dictionary.ts` | 34 new HubSpot → DB mappings |
| `src/hire-request/hire-request.service.ts` | Removal of leftover `console.log` |

---

## Fields Added to the `Candidate` Model

All fields are of type `String?` (optional, free text) and reflect the evaluation criteria from the VA Score Card filled out during the recruitment process in HubSpot.

### Communication

| DB Field | HubSpot Field | Description |
|---|---|---|
| `active_listening_and_comprehension_demonstrated` | `active_listening_and_comprehension_demonstrated` | Demonstrates active listening and comprehension |
| `speaks_clearly_and_professionally` | `speaks_clearly_and_professionally` | Speaks clearly and professionally |
| `grammar__vocabulary__and_tone_are_appropriate_for_us_clients` | `grammar__vocabulary__and_tone_are_appropriate_for_us_clients` | Grammar, vocabulary, and tone appropriate for US clients |
| `communication_skills_evaluator_notes` | `communication_skills_evaluator_notes` | Evaluator notes on communication skills |
| `confident_on_video_and_phone_calls` | `confident_on_video_and_phone_calls` | Confident on video and phone calls |
| `for_bilinguals__fluent_and_accurate_in_both_english_and_spanish` | `for_bilinguals__fluent_and_accurate_in_both_english_and_spanish` | For bilinguals: fluent and accurate in both English and Spanish |

### Technical Competence

| DB Field | HubSpot Field | Description |
|---|---|---|
| `can_multitask_between_systems_or_windows_efficiently` | `can_multitask_between_systems_or_windows_efficiently` | Can multitask between systems or windows efficiently |
| `comfortable_with_basic_tools__google_workspace__zoom__ehr_software_` | `comfortable_with_basic_tools__google_workspace__zoom__ehr_software_` | Comfortable with Google Workspace, Zoom, and EHR software |
| `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks__etc__` | `familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks__etc__` | Familiarity with EMR/EHR systems (Kareo, Athena, eClinicalWorks, etc.) |
| `demonstrates_problem_solving_and_tech_adaptability` | `demonstrates_problem_solving_and_tech_adaptability` | Demonstrates problem-solving and tech adaptability |
| `has_functioning_headset__webcam__and_backup_device` | `has_functioning_headset__webcam__and_backup_device` | Has a functioning headset, webcam, and backup device |
| `stable_internet_connection__min__20_mbps_` | `stable_internet_connection__min__20_mbps_` | Stable internet connection (minimum 20 Mbps) |
| `technical_competence_evaluator_notes` | `technical_competence_evaluator_notes` | Evaluator notes on technical competence |

### Medical Knowledge

| DB Field | HubSpot Field | Description |
|---|---|---|
| `demonstrates_understanding_of_medical_terminology_and_procedures` | `demonstrates_understanding_of_medical_terminology_and_procedures` | Demonstrates understanding of medical terminology and procedures |
| `prior_experience_in_healthcare_or_medical_va_roles` | `prior_experience_in_healthcare_or_medical_va_roles` | Prior experience in healthcare or medical VA roles |
| `no_medical_industry_experience` | `no_medical_industry_experience` | No medical industry experience |
| `knowledge_of_hipaa_compliance_and_confidentiality` | `knowledge_of_hipaa_compliance_and_confidentiality` | Knowledge of HIPAA compliance and confidentiality |
| `understands_workflow_in_medical_offices___telehealth_environments` | `understands_workflow_in_medical_offices___telehealth_environments` | Understands workflow in medical offices and telehealth environments |
| `medical_knowledge_evaluator_notes` | `medical_knowledge_evaluator_notes` | Evaluator notes on medical knowledge |

### Professionalism & Work Readiness

| DB Field | HubSpot Field | Description |
|---|---|---|
| `positive_attitude_and_professional_demeanor` | `positive_attitude_and_professional_demeanor` | Positive attitude and professional demeanor |
| `punctual_and_responsive_during_recruitment_stages` | `punctual_and_responsive_during_recruitment_stages` | Punctual and responsive during recruitment stages |
| `remote_work_discipline_and_time_management` | `remote_work_discipline_and_time_management` | Remote work discipline and time management |
| `demonstrates_stability_and_commitment` | `demonstrates_stability_and_commitment` | Demonstrates stability and commitment |
| `comfortable_with_camera_on_setup` | `comfortable_with_camera_on_setup` | Comfortable with camera-on setup |
| `handles_feedback_constructively` | `handles_feedback_constructively` | Handles feedback constructively |
| `professionalism___work_readiness_evaluator_notes` | `professionalism___work_readiness_evaluator_notes` | Evaluator notes on professionalism and work readiness |

### Client Readiness & Fit

| DB Field | HubSpot Field | Description |
|---|---|---|
| `can_articulate_experience_clearly_to_clients` | `can_articulate_experience_clearly_to_clients` | Can articulate experience clearly to clients |
| `cultural_alignment_with_us_healthcare_environment` | `cultural_alignment_with_us_healthcare_environment` | Cultural alignment with the US healthcare environment |
| `adaptability_to_different_client_personalities_and_workflows` | `adaptability_to_different_client_personalities_and_workflows` | Adaptability to different client personalities and workflows |
| `exhibits_confidence_and_empathy_in_roleplay_scenarios` | `exhibits_confidence_and_empathy_in_roleplay_scenarios` | Exhibits confidence and empathy in roleplay scenarios |
| `client_readiness___fit_evaluator_notes` | `client_readiness___fit_evaluator_notes` | Evaluator notes on client readiness and fit |

### Score & Tier

| DB Field | HubSpot Field | Description |
|---|---|---|
| `tier_level` | `tier_level` | Candidate tier level (e.g. Tier 1, Tier 2) |
| `total_points` | `total_points` | Total points from the VA Score Card |

---

## Field Dictionary (`candidate-dictionary.ts`)

The `candidadeToDbDictionary` was updated with all 34 fields above. This dictionary is used by the HubSpot sync service to convert HubSpot property names into database column names.

```
HubSpot property name  →  DB column name
```

The `dbToCandidateDictionary` (reverse mapping) is automatically generated from the same object and requires no manual changes.

---

## Sync Flow

```
HubSpot Webhook / Sync Job
        │
        ▼
candidadeToDbDictionary (field mapping)
        │
        ▼
Prisma Candidate.update({ data: { ...va_score_fields } })
        │
        ▼
PostgreSQL Database ("Candidate" table)
```

**Direction:** HubSpot → Platform only. These fields are **never written back** to HubSpot by the platform.

---

## SQL Migration

File: `prisma/migrations/20260223164133_include_fields_from_va_score/migration.sql`

Run via `prisma migrate deploy`. Adds 34 nullable `TEXT` columns to the `"Candidate"` table.
