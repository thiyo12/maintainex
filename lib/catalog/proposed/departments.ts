import type { ProposedDepartment } from '../proposed-expansion'

/**
 * PROPOSED departments. None were previously approved; each is imported
 * inactive until reviewed.
 */
export const PROPOSED_DEPARTMENTS: ProposedDepartment[] = [
  {
    name: 'Pet Care Services',
    slug: 'pet-care-services',
    description:
      'In-home and on-site care for dogs, cats and other household pets, including feeding, walking, grooming assistance and cover while the owner is away.',
    markets: ['LK', 'CA'],
    iconName: 'paw-print',
    colorHex: '#8D6E63',
    sortOrder: 25,
  },
  {
    name: 'Waste Management and Junk Removal',
    slug: 'waste-management-and-junk-removal',
    description:
      'Collection, sorting, transport and lawful disposal of household waste, bulky items and post-project debris, with proof of disposal.',
    markets: ['LK', 'CA'],
    iconName: 'trash-2',
    colorHex: '#607D8B',
    sortOrder: 26,
  },
  {
    name: 'Childcare and Family Support',
    slug: 'childcare-and-family-support',
    description:
      'Home-based childcare, school-run assistance and household support delivered by identity-verified providers with safeguarding training.',
    markets: ['LK', 'CA'],
    iconName: 'baby',
    colorHex: '#F06292',
    sortOrder: 27,
  },
]
