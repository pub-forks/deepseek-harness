import { expect, it } from 'vitest'
import { resolveChangesReview } from '../src/client/open-changes-review.ts'

it('decodes only bounded turn review coordinates and preserves the selected file', () => {
  const address = 'dsh-resource://changes-review/session/s-1/32/2'
  expect(resolveChangesReview(address, { index: 3 })).toEqual({ sessionId: 's-1', seq: 32, turn: 2, index: 3 })
  expect(resolveChangesReview(address, undefined)?.index).toBe(0)
  for (const bad of [address + '/x', address.replace('/32/', '/-1/'), address.replace('/2', '/0'), address.replace('s-1', '%2Fetc'), address.replace('32', '9007199254740992')]) {
    expect(resolveChangesReview(bad, undefined)).toBeUndefined()
  }
  for (const index of [-1, 0.5, '1', Infinity]) expect(resolveChangesReview(address, { index })).toBeUndefined()
})
