import { SERVICES_BATCH_1 } from './services-batch-1'
import { SERVICES_BATCH_2 } from './services-batch-2'
import { SERVICES_BATCH_3 } from './services-batch-3'
import { SERVICES_BATCH_4 } from './services-batch-4'
import { SERVICES_BATCH_5 } from './services-batch-5'
import { SERVICES_BATCH_6 } from './services-batch-6'

import type { ProposedService } from '../proposed-expansion'

/**
 * Every proposed service, assembled from its authoring batches.
 *
 * IMPORTANT: this dataset was never previously approved. Entries are imported
 * with isActive = false until the catalogue is reviewed and signed off.
 */
export const PROPOSED_SERVICES: ProposedService[] = [
  ...SERVICES_BATCH_1,
  ...SERVICES_BATCH_2,
  ...SERVICES_BATCH_3,
  ...SERVICES_BATCH_4,
  ...SERVICES_BATCH_5,
  ...SERVICES_BATCH_6,
]
