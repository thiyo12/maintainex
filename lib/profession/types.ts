export type ProfessionStatus = 'ACTIVE' | 'INACTIVE'
export type ProviderProfessionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type SubmissionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DUPLICATE'
export type RequirementMode = 'REQUIRED_ALL' | 'REQUIRED_ANY_OF' | 'PREFERRED'

export interface ProfessionCreateInput {
  slug: string
  i18nKey: string
  description?: string
  sortOrder?: number
}

export interface ProfessionUpdateInput {
  slug?: string
  i18nKey?: string
  description?: string | null
  isActive?: boolean
  sortOrder?: number
}

export interface ProfessionSkillCreateInput {
  professionId: string
  slug: string
  i18nKey: string
  description?: string
  sortOrder?: number
}

export interface ServiceProfessionRequirementInput {
  serviceTemplateId: string
  professionId: string
  alternativeGroupId?: string | null
}

export interface ServiceSkillRequirementInput {
  serviceProfessionReqId: string
  professionSkillId: string
  requirementMode: RequirementMode
}

export interface TaskerProfessionInput {
  taskerProfileId: string
  professionId: string
}

export interface TaskerProfessionSkillInput {
  taskerProfessionId: string
  professionSkillId: string
}

export interface CompanyProfessionInput {
  companyProfileId: string
  professionId: string
}

export interface CompanyProfessionSkillInput {
  companyProfessionId: string
  professionSkillId: string
}

export interface ProfessionSubmissionInput {
  submittedById: string
  requestedName: string
  description?: string
  suggestedServices?: string[]
}

export interface SubmissionReviewInput {
  submissionId: string
  status: 'APPROVED' | 'REJECTED' | 'DUPLICATE'
  canonicalProfessionId?: string
  reviewNote?: string
  reviewedBy: string
}

export interface ProfessionWithSkills {
  id: string
  slug: string
  i18nKey: string
  description: string | null
  isActive: boolean
  sortOrder: number
  skills: {
    id: string
    slug: string
    i18nKey: string
    description: string | null
    isActive: boolean
    sortOrder: number
  }[]
}

export interface ProviderProfessionCapability {
  id: string
  status: ProviderProfessionStatus
  approvedAt: Date | null
  approvedBy: string | null
  profession: {
    id: string
    slug: string
    i18nKey: string
  }
  skills: {
    id: string
    professionSkill: {
      id: string
      slug: string
      i18nKey: string
    }
  }[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
