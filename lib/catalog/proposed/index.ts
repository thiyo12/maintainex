import { SERVICES_BATCH_1 } from './services-batch-1'
import { SERVICES_BATCH_2 } from './services-batch-2'

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
]
