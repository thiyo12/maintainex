# ADR-010: Hierarchical Profession-to-Skill Model

**Status**: Accepted
**Date**: 2026-09-14

## Context

The marketplace serves diverse home services: plumbing, electrical, cleaning, painting, and dozens more. A flat tag-based system cannot capture that "Licensed Electrician" is a profession requiring specific skills (wiring, panel installation, code compliance), while "Help Moving" requires体力 and vehicle access but no formal certification.

The matching engine needs structured data to filter providers by capability, and the admin panel needs a taxonomy for organizing services and pricing templates.

Reference: `lib/profession/index.ts` (598 lines), `lib/profession/types.ts`

## Decision

Implement a two-level hierarchical taxonomy:

### Model Structure

```
Profession (e.g., "Electrical Services")
  └── ProfessionSkill (e.g., "Panel Upgrade", "Wiring Repair", "Code Inspection")
```

### Profession Attributes

- `slug`: URL-safe unique identifier
- `name`: Display name
- `description`: Human-readable description
- `isActive`: Soft-delete toggle
- `countryCode`: Country-specific or GLOBAL

### Skill Attributes

- `professionId`: FK to parent profession
- `name`: Display name
- `isRequired`: Whether this skill is mandatory for the profession
- `credentialRequired`: Whether a license/certification is needed

### Provider Capabilities

Providers (both individual and company) declare their capabilities:
- `TaskerProfession` / `CompanyProfession`: Links provider to profession
- `TaskerProfessionSkill` / `CompanyProfessionSkill`: Links provider to specific skills
- Providers submit profession declarations for admin approval

### Matching Integration

The eligibility engine in `lib/matching/eligibility.ts` uses the profession hierarchy:
- Gate: Provider must have an approved profession matching the job category
- Gate: Provider must have all required skills for the job
- Scoring: `capability` component (30% weight) is influenced by skill coverage

### Service Templates

`ServiceTemplate` references a `professionId`, linking pricing templates to the profession taxonomy. This ensures pricing consistency within a profession.

## Consequences

### Positive
- Structured matching: eligibility checks against specific skills, not vague tags
- Admin control: professions and skills are admin-managed, not user-generated
- Credential tracking: skills can require verified certifications
- Pricing alignment: templates tied to professions ensure consistent pricing

### Negative
- Maintenance burden: admins must populate and curate the taxonomy
- Migration complexity: existing flat tag systems need data migration
- Over-specification: some services may not fit neatly into one profession

### Neutral
- Hierarchical model is extensible: future versions could add sub-categories
- Country-specific professions allow LK-specific services (e.g., "Coconut Climbing") alongside global ones
