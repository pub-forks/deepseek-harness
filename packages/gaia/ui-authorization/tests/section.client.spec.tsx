// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthorizationSection, preferredMethod, type AuthorizationSectionInjected } from '../src/client/AuthorizationSection.tsx'
import { brandString } from '@deepseek-ai/dsh-brand'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import { en } from '../src/client/locales.ts'
import type {} from '../src/client/index.ts'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttemptId, AttemptItem, FlowView, PromptId } from '../../api-authorization/src/types.ts'

afterEach(cleanup)
const flow: FlowView = { key: credentialKey('llm-pi-ai', 'openai-codex'), label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth' }, { id: 'device', label: 'Device code' }], inFlight: false, signedIn: true }
function mount(items: AttemptItem[] = []) {
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => [flow]),
    start: vi.fn(async function* () { for (const item of items) yield item }),
    answer: vi.fn(async () => true),
    cancel: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }
  const globals = {} as GlobalStandardProps
  render(<AuthorizationSection {...globals} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key}
    close={() => {}} openSection={() => {}} />)
  return operations
}

it('lists flows and prefers a declared device method', async () => {
  const operations = mount()
  expect(await screen.findByText('Codex')).toBeTruthy()
  expect(preferredMethod(flow)).toBe('device')
  fireEvent.click(screen.getByRole('button', { name: en.signIn }))
  await waitFor(() => { expect(operations.start).toHaveBeenCalledWith({ key: flow.key, method: 'device' }, expect.any(AbortSignal)) })
})

it('shows device code and prompt, answers it, and removes withdrawn prompts', async () => {
  const operations = mount([
    { attemptId: brandString<AttemptId>('one'), type: 'notice', message: 'Enter the code', url: 'https://example.test', code: 'ABCD' },
    { attemptId: brandString<AttemptId>('one'), type: 'prompt', promptId: brandString<PromptId>('p1'), kind: 'text', message: 'Paste callback' },
    { attemptId: brandString<AttemptId>('one'), type: 'withdrawn', promptId: brandString<PromptId>('p1') },
    { attemptId: brandString<AttemptId>('one'), type: 'prompt', promptId: brandString<PromptId>('p2'), kind: 'secret', message: 'Password' },
  ])
  await screen.findByText('Codex')
  fireEvent.click(screen.getByRole('button', { name: en.signIn }))
  expect(await screen.findByText('ABCD')).toBeTruthy()
  const open = screen.getByRole('link', { name: en.open })
  expect(open.getAttribute('target')).toBe('_blank')
  expect(open.getAttribute('rel')).toBe('noopener noreferrer')
  expect(await screen.findByText('Password')).toBeTruthy()
  expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password')
  expect(screen.queryByText('Paste callback')).toBeNull()
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'typed' } })
  fireEvent.click(screen.getByRole('button', { name: en.submit }))
  await waitFor(() => { expect(operations.answer).toHaveBeenCalledWith('one', 'p2', 'typed') })
})

it('confirms sign-out through the shared modal', async () => {
  const operations = mount()
  await screen.findByText('Codex')
  fireEvent.click(screen.getByRole('button', { name: en.signOut }))
  expect(await screen.findByText(en.confirmDescription)).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: en.signOut }).at(-1) as HTMLElement)
  await waitFor(() => { expect(operations.signOut).toHaveBeenCalledWith(flow.key) })
})

it('opens Models settings after authorization', async () => {
  const openSection = vi.fn()
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => [flow]),
    start: vi.fn(async function* () { yield { attemptId: brandString<AttemptId>('one'), type: 'done' as const, outcome: 'authorized' as const } }),
    answer: vi.fn(async () => true), cancel: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
  }
  const globals = {} as GlobalStandardProps
  render(<AuthorizationSection {...globals} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key}
    close={() => {}} openSection={openSection} />)
  await screen.findByText('Codex')
  fireEvent.click(screen.getByRole('button', { name: en.signIn }))
  fireEvent.click(await screen.findByRole('link', { name: en.models }))
  expect(openSection).toHaveBeenCalledWith('models')
})
