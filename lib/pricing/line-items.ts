import type { PrismaClient } from '@prisma/client'
import type {
  QuoteLineItemInput,
  QuoteTotalValidation,
  LineItemType,
} from './benchmark-types'

const VALID_LINE_ITEM_TYPES: LineItemType[] = [
  'LABOUR', 'MATERIALS', 'CALL_OUT', 'DIAGNOSIS', 'TRAVEL',
  'EQUIPMENT', 'PERMIT', 'OTHER', 'TAX', 'PLATFORM_SERVICE_CHARGE',
]

const NON_NEGATIVE_TYPES: LineItemType[] = [
  'LABOUR', 'MATERIALS', 'CALL_OUT', 'DIAGNOSIS', 'TRAVEL',
  'EQUIPMENT', 'PERMIT', 'OTHER', 'PLATFORM_SERVICE_CHARGE',
]

/**
 * Validate a set of line items for a quote.
 * Checks types, currencies, quantities, amounts, and server-calculates totals.
 */
export function validateLineItems(
  items: QuoteLineItemInput[],
  quoteCurrency: string,
): { valid: boolean; errors: string[]; validatedItems: Array<QuoteLineItemInput & { totalAmountCents: bigint; sortOrder: number }> } {
  const errors: string[] = []
  const validated: Array<QuoteLineItemInput & { totalAmountCents: bigint; sortOrder: number }> = []

  if (items.length === 0) {
    errors.push('Quote must have at least one line item')
    return { valid: false, errors, validatedItems: [] }
  }

  let sortOrder = 0
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const prefix = `Line item ${i + 1}`

    // Validate type
    if (!VALID_LINE_ITEM_TYPES.includes(item.type)) {
      errors.push(`${prefix}: invalid type "${item.type}"`)
      continue
    }

    // Validate currency matches quote
    if (item.currency !== quoteCurrency) {
      errors.push(`${prefix}: currency "${item.currency}" does not match quote currency "${quoteCurrency}"`)
      continue
    }

    // Validate quantity
    if (item.quantity <= 0) {
      errors.push(`${prefix}: quantity must be positive, got ${item.quantity}`)
      continue
    }

    // Validate unit amount
    if (item.unitAmountCents < 0n) {
      errors.push(`${prefix}: unit amount must be non-negative`)
      continue
    }

    // For non-TAX types, amounts must be non-negative
    if (NON_NEGATIVE_TYPES.includes(item.type) && item.unitAmountCents < 0n) {
      errors.push(`${prefix}: ${item.type} amount must be non-negative`)
      continue
    }

    // Calculate total (server-side, not trusted from client)
    const serverTotal = BigInt(Math.round(item.quantity)) * item.unitAmountCents

    validated.push({
      ...item,
      totalAmountCents: serverTotal,
      sortOrder: item.sortOrder ?? sortOrder,
    })
    sortOrder++
  }

  // Check for duplicate types (except TAX and OTHER which can appear multiple times)
  const typeCounts = new Map<string, number>()
  for (const item of validated) {
    typeCounts.set(item.type, (typeCounts.get(item.type) || 0) + 1)
  }
  for (const [type, count] of typeCounts) {
    if (count > 1 && type !== 'TAX' && type !== 'OTHER') {
      errors.push(`Duplicate line item type: ${type} (${count} times)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validatedItems: validated,
  }
}

/**
 * Calculate and validate quote totals from line items.
 * Server is source of truth for totals.
 */
export function calculateQuoteTotal(
  validatedItems: Array<{ totalAmountCents: bigint; type: LineItemType }>,
  submittedSubtotalCents: bigint | null,
  submittedTotalCents: bigint | null,
): QuoteTotalValidation {
  const errors: string[] = []

  // Calculate server subtotal (all items except TAX)
  const serverSubtotalCents = validatedItems
    .filter(item => item.type !== 'TAX')
    .reduce((sum, item) => sum + item.totalAmountCents, 0n)

  // Calculate server tax ( TAX items only)
  const serverTaxCents = validatedItems
    .filter(item => item.type === 'TAX')
    .reduce((sum, item) => sum + item.totalAmountCents, 0n)

  const serverTotalCents = serverSubtotalCents + serverTaxCents

  // Validate submitted totals match server calculation
  let mismatch = false
  if (submittedSubtotalCents !== null && submittedSubtotalCents !== serverSubtotalCents) {
    mismatch = true
    errors.push(`Submitted subtotal ${submittedSubtotalCents} does not match server ${serverSubtotalCents}`)
  }
  if (submittedTotalCents !== null && submittedTotalCents !== serverTotalCents) {
    mismatch = true
    errors.push(`Submitted total ${submittedTotalCents} does not match server ${serverTotalCents}`)
  }

  return {
    valid: errors.length === 0,
    serverSubtotalCents,
    serverTaxCents,
    serverTotalCents,
    submittedSubtotalCents,
    submittedTotalCents,
    mismatch,
    errors,
  }
}

/**
 * Persist line items for a quote.
 */
export async function persistLineItems(
  client: PrismaClient,
  quoteId: string,
  items: Array<QuoteLineItemInput & { totalAmountCents: bigint; sortOrder: number }>,
): Promise<void> {
  // Delete existing line items (for revision scenarios)
  await client.quoteLineItem.deleteMany({ where: { quoteId } })

  // Create new line items
  for (const item of items) {
    await client.quoteLineItem.create({
      data: {
        quoteId,
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit ?? null,
        unitAmountCents: item.unitAmountCents,
        totalAmountCents: item.totalAmountCents,
        currency: item.currency,
        sortOrder: item.sortOrder,
        metadata: item.metadata ?? null,
      },
    })
  }
}
