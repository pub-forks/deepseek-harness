import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import * as scheduleUsage from '../src/client/index.ts'

interface Registration {
  readonly options: Record<string, unknown>
  readonly component: unknown
}

const instances: Array<{ ctx: Context; directory: string }> = []
afterEach(async () => {
  for (const instance of instances.splice(0)) {
    await instance.ctx.fiber.dispose()
    await rm(instance.directory, { recursive: true, force: true })
  }
})

it('loads through cordis.yml and removes panel registrations when the entry fiber is disposed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gaia-schedule-usage-client-'))
  const ctx = new Context()
  instances.push({ ctx, directory })
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include

  const registrations: Registration[] = []
  let remoteDisposed = false
  const remotePlugin = {
    apply(context: Context) {
      context.provide('remote', {
        $mount: async () => async () => { remoteDisposed = true },
      } as never)
      context.provide('remote.gaiaScheduleUsage', { dashboard: async () => ({ ok: true, value: {} }) } as never)
    },
  }
  const localePlugin = {
    apply(context: Context) {
      const dictionaries = new Map<string, { en: Record<string, string> }>()
      context.provide('locale', {
        register(namespace: string, value: { en: Record<string, string> }) {
          dictionaries.set(namespace, value)
          return () => { dictionaries.delete(namespace) }
        },
        bind(namespace: string) {
          return (key: string) => dictionaries.get(namespace)?.en[key] ?? key
        },
      } as never)
    },
  }
  const slotsPlugin = {
    apply(context: Context) {
      context.provide('slots', {
        inject(_name: string, contribute: () => () => void) { return contribute() },
        register(options: Record<string, unknown>, component: unknown) {
          const registration = { options, component }
          registrations.push(registration)
          return () => {
            const index = registrations.indexOf(registration)
            if (index >= 0) registrations.splice(index, 1)
          }
        },
      } as never)
    },
  }
  const modules = new Map<string, unknown>([
    ['test:remote', remotePlugin], ['test:locale', localePlugin], ['test:slots', slotsPlugin],
    ['@deepseek-ai/dsh-gaia-schedule-usage', scheduleUsage],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      const module = modules.get(specifier)
      if (module === undefined) throw new Error(`Unexpected plugin: ${specifier}`)
      return module
    },
  } as never

  const config = join(directory, 'cordis.yml')
  await writeFile(config, [
    '- id: test-remote\n  name: test:remote',
    '- id: test-locale\n  name: test:locale',
    '- id: test-slots\n  name: test:slots',
    "- id: schedule-usage\n  name: '@deepseek-ai/dsh-gaia-schedule-usage'\n  config: {}",
    '',
  ].join('\n'))
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()

  expect(registrations.map(row => row.options)).toEqual([
    expect.objectContaining({ name: 'main', key: 'schedule-usage' }),
    expect.objectContaining({ name: 'sidebar.panellist', id: 'schedule-usage', label: expect.any(Function) as () => string }),
  ])
  const usage = [...ctx.loader.entries()].find(entry => entry.options.id === 'schedule-usage')
  if (usage?.fiber === undefined) throw new Error('schedule usage Loader entry was not mounted')
  await usage.fiber.dispose()
  expect(registrations).toHaveLength(0)
  expect(remoteDisposed).toBe(true)
})
