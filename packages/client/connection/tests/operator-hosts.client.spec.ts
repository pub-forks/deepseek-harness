/** GAIA: Operator-authority classification through the browser plugin composition. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, installConnection, type ConnectionHandle } from '../src/client/index.ts'

afterEach(() => { vi.unstubAllGlobals() })

async function mount(href: string, hosts?: unknown): Promise<ConnectionHandle> {
  vi.stubGlobal('location', new URL(href))
  if (hosts !== undefined) vi.stubGlobal('__DSH_OPERATOR_HOSTS__', hosts)
  const ctx = new Context()
  await ctx.plugin({ apply, inject: [] })
  const handle = ctx.get('connection') as ConnectionHandle | undefined
  if (handle === undefined) throw new Error('ctx.connection not provided')
  return handle
}

describe('Gaia operator hosts', () => {
  it.each([
    ['https://AI.RAYA.WORK:443/api/harness/rt/', ['AI.RAYA.WORK']],
    ['https://ai.raya.work:8443/', ['AI.RAYA.WORK:8443']],
    ['https://[2001:db8::1]:8443/', ['[2001:db8::1]:8443']],
  ])('enables Host settings for the matching normalized authority: %s', async (href, hosts) => {
    expect((await mount(href, hosts)).isLoopback).toBe(true)
  })

  it.each([
    ['https://other.example/', ['ai.raya.work']],
    ['https://ai.raya.work.evil.example/', ['ai.raya.work']],
    ['https://ai.raya.work/', ['*.raya.work']],
    ['https://ai.raya.work:8443/', ['ai.raya.work']],
    ['https://ai.raya.work/', ['ai.raya.work:8443']],
    ['https://ai.raya.work:8443/', ['ai.raya.work:9443']],
    ['https://ai.raya.work/', undefined],
    ['https://ai.raya.work/', 'ai.raya.work'],
    ['https://ai.raya.work/', { host: 'ai.raya.work' }],
    ['https://ai.raya.work/', [null, 42, {}, 'bad host', '[::invalid]']],
  ])('keeps settings browser-local without an exact authority match: %s %j', async (href, hosts) => {
    expect((await mount(href, hosts)).isLoopback).toBe(false)
  })

  it('ignores malformed and non-string entries beside a valid authority', async () => {
    expect((await mount('https://ai.raya.work/', [null, 42, '[::invalid]', 'AI.RAYA.WORK'])).isLoopback).toBe(true)
  })

  it('uses only explicit install inputs rather than the page global', () => {
    vi.stubGlobal('__DSH_OPERATOR_HOSTS__', ['ai.raya.work'])
    const ctx = new Context()
    installConnection(ctx, { location: new URL('https://ai.raya.work/') })
    expect((ctx.get('connection') as ConnectionHandle).isLoopback).toBe(false)
  })

  it('ignores an unparsable page URL', () => {
    const ctx = new Context()
    installConnection(ctx, { location: { hostname: 'ai.raya.work', href: 'invalid' }, operatorHosts: ['ai.raya.work'] })
    expect((ctx.get('connection') as ConnectionHandle).isLoopback).toBe(false)
  })
})
