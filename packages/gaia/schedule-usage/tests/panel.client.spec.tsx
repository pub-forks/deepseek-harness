// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ScheduleUsagePanel } from '../src/client/ScheduleUsagePanel.tsx'
import { en, type ScheduleUsageKey } from '../src/client/locales.ts'
import type { ScheduledRunUsage, ScheduleUsageDashboard, ScheduleUsageQuery } from '../src/types.ts'

afterEach(cleanup)

const run: ScheduledRunUsage = {
  messageId: 'message', targetSessionId: SessionId('session'),
  scheduledAt: '2026-11-07T08:00:00.000Z', deliveredAt: '2026-11-07T08:01:00.000Z',
  tasks: [{ id: 'first', title: 'First' }, { id: 'second', title: 'Second' }],
  usageAvailable: true, usage: [],
  totals: { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 20000, cacheWriteTokens: 0, costUsd: 0.5 },
}

const data: ScheduleUsageDashboard = {
  totalTaskCount: 2,
  taskOptions: [{ id: 'first', title: 'First', status: 'active' }, { id: 'second', title: 'Second', status: 'paused' }],
  tasks: [
    { id: 'first', title: 'First', status: 'active', runs: [], sharedRunCount: 1, earlierRunsAvailable: false, earlierRunsPruned: false },
    { id: 'second', title: 'Second', status: 'paused', runs: [], sharedRunCount: 1, earlierRunsAvailable: false, earlierRunsPruned: false },
  ],
  sharedBatches: [run],
  pricingUpdatedAt: null,
  pricingAvailable: false,
  truncated: true,
}

function mount() {
  const load = vi.fn(async (_query: ScheduleUsageQuery) => data)
  const globals = {} as GlobalStandardProps
  const t = (key: ScheduleUsageKey): string => en[key]
  render(<ScheduleUsagePanel {...globals} load={load} t={t} />)
  return load
}

it('shows cache-inclusive totals and one shared batch heading', async () => {
  mount()
  await screen.findByText(en.sharedBatches)
  expect(screen.getAllByText('21,100')).not.toHaveLength(0)
  expect(screen.getByText(en.pricingUnavailable)).toBeTruthy()
  expect(screen.getByText(en.truncated)).toBeTruthy()
})

it('reloads with the selected tasks and the chosen day range', async () => {
  const load = mount()
  await waitFor(() => { expect(load).toHaveBeenCalledTimes(1) })
  const initial = load.mock.calls[0]![0]
  expect(initial.taskIds).toBeUndefined()
  expect(Date.parse(initial.from)).toBeLessThan(Date.parse(initial.to))

  fireEvent.click(await screen.findByRole('checkbox', { name: /First/ }))
  await waitFor(() => { expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ taskIds: ['first'] })) })

  fireEvent.change(screen.getByLabelText(en.startDate), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText(en.endDate), { target: { value: '2026-11-03' } })
  await waitFor(() => {
    const last = load.mock.lastCall![0]
    expect(new Date(last.from).getDate()).toBe(1)
    expect(new Date(last.to).getDate()).toBe(3)
  })
})

it('does not load an inverted range', async () => {
  const load = mount()
  await waitFor(() => { expect(load).toHaveBeenCalledTimes(1) })
  fireEvent.change(screen.getByLabelText(en.endDate), { target: { value: '2000-01-01' } })
  expect(await screen.findByText(en.invalidRange)).toBeTruthy()
  expect(load).toHaveBeenCalledTimes(1)
})
