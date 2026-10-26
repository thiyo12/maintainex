import { describe, expect, it } from 'vitest'
import addressparser from 'nodemailer/lib/addressparser'
import selectorParser from 'postcss-selector-parser'

describe('patched dependency advisory regressions', () => {
  it('keeps nested comments from redirecting a Nodemailer recipient', () => {
    const parsed = addressparser('Victim (x(y) <evil@evil.com>) <v@victim.com>')

    expect(parsed.map(({ address }) => address)).toEqual(['v@victim.com'])
  })

  it('keeps a quoted angle-bracket local part bound to its actual domain', () => {
    const parsed = addressparser('<"a@evil.com>"@good.com>')

    expect(parsed.map(({ address }) => address)).toEqual(['"a@evil.com>"@good.com'])
  })

  it('does not split a semicolon in a quoted display name into another recipient', () => {
    const parsed = addressparser('"Billing; Admin" <billing@example.com>')

    expect(parsed).toEqual([{ address: 'billing@example.com', name: 'Billing; Admin' }])
  })

  it('parses long flat selectors without losing selector nodes', () => {
    const classCount = 5_000
    const selector = Array.from({ length: classCount }, (_, index) => `.c${index}`).join('')
    let parsedClassCount = 0

    selectorParser((root) => {
      root.walkClasses(() => {
        parsedClassCount += 1
      })
    }).processSync(selector, { lossless: false })

    expect(parsedClassCount).toBe(classCount)
  })
})
