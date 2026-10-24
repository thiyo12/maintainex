/**
 * Worker-count contract shared by job creation, editing and workforce dispatch.
 * A count is a positive integer: never coerce booleans, fractions or exponential
 * strings into a dispatchable crew. Prisma Int fields are signed 32-bit.
 */
export function parseWorkerCount(input: unknown): number | null {
  let value: number
  if (typeof input === 'number') {
    value = input
  } else if (typeof input === 'string' && /^[1-9][0-9]*$/.test(input.trim())) {
    value = Number(input.trim())
  } else {
    return null
  }
  return Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647
    ? value
    : null
}
