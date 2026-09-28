// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
function mount(items: AttemptItem[] = [], listedFlows: FlowView[] = [flow]) {
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => listedFlows),
    start: vi.fn(async function* () { for (const item of items) yield item }),
    answer: vi.fn(async () => true),
    cancel: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    createAccount: vi.fn(async () => {}),
    removeAccount: vi.fn(async () => {}),
  }
  const globals = {} as GlobalStandardProps
  render(<AuthorizationSection {...globals} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key}
    close={() => {}} openSection={() => {}} />)
  return operations
}

it('creates and removes independently named OAuth aliases from the localized controls', async () => {
  const alias: FlowView = { key: credentialKey('llm-pi-ai', 'codex-work'), label: 'Work Codex', methods: [{ id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: true, accountAlias: true }
  const operations = mount([], [flow, alias])
  await screen.findByText('Work Codex', { selector: 'strong' })
  fireEvent.change(screen.getByLabelText(en.accountLabel), { target: { value: 'Office' } })
  fireEvent.change(screen.getByLabelText(en.accountId), { target: { value: 'codex-office' } })
  fireEvent.click(screen.getByRole('button', { name: en.addAccount }))
  await waitFor(() => { expect(operations.createAccount).toHaveBeenCalledWith('openai-codex', 'codex-office', 'Office') })
  fireEvent.click(screen.getByRole('button', { name: en.removeAccount }))
  const removeButtons = screen.getAllByRole('button', { name: en.removeAccount })
  fireEvent.click(removeButtons[removeButtons.length - 1]!)
  await waitFor(() => { expect(operations.removeAccount).toHaveBeenCalledWith(alias.key) })
})

it('lists the OAuth method without a method picker', async () => {
  const operations = mount()
  expect(await screen.findByText('Codex', { selector: 'strong' })).toBeTruthy()
  expect(preferredMethod(flow)).toBe('device')
  expect(screen.queryByLabelText(en.method)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.signIn }))
  await waitFor(() => { expect(operations.start).toHaveBeenCalledWith({ key: flow.key, method: 'oauth' }, expect.any(AbortSignal)) })
})

it('shows device code and prompt, answers it, and removes withdrawn prompts', async () => {
  const operations = mount([
    { attemptId: brandString<AttemptId>('one'), type: 'notice', message: 'Enter the code', url: 'https://example.test', code: 'ABCD' },
    { attemptId: brandString<AttemptId>('one'), type: 'prompt', promptId: brandString<PromptId>('p1'), kind: 'text', message: 'Paste callback' },
    { attemptId: brandString<AttemptId>('one'), type: 'withdrawn', promptId: brandString<PromptId>('p1') },
    { attemptId: brandString<AttemptId>('one'), type: 'prompt', promptId: brandString<PromptId>('p2'), kind: 'secret', message: 'Password' },
  ])
  await screen.findByText('Codex', { selector: 'strong' })
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

it('preselects device code in the OpenAI OAuth prompt', async () => {
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => [flow]),
    start: vi.fn(async function* () {
      yield {
        attemptId: brandString<AttemptId>('one'), type: 'prompt' as const,
        promptId: brandString<PromptId>('choice'), kind: 'select' as const, message: 'Choose sign-in',
        options: [{ id: 'browser', label: 'Browser callback' }, { id: 'device', label: 'Device code' }],
      }
    }),
    answer: vi.fn(async () => true), cancel: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
    createAccount: vi.fn(async () => {}), removeAccount: vi.fn(async () => {}),
  }
  render(<AuthorizationSection {...({} as GlobalStandardProps)} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key} close={() => {}} openSection={() => {}} />)
  expect(await screen.findByText('Codex', { selector: 'strong' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: en.signIn }))
  const choice = await screen.findByLabelText('Choose sign-in') as HTMLSelectElement
  expect(choice.value).toBe('device')
})

it('confirms sign-out through the shared modal', async () => {
  const operations = mount()
  await screen.findByText('Codex', { selector: 'strong' })
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
    createAccount: vi.fn(async () => {}), removeAccount: vi.fn(async () => {}),
  }
  const globals = {} as GlobalStandardProps
  render(<AuthorizationSection {...globals} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key}
    close={() => {}} openSection={openSection} />)
  await screen.findByText('Codex', { selector: 'strong' })
  fireEvent.click(screen.getByRole('button', { name: en.signIn }))
  fireEvent.click(await screen.findByRole('link', { name: en.models }))
  expect(openSection).toHaveBeenCalledWith('models')
})

it('opens Models settings from the API-key note', async () => {
  const openSection = vi.fn()
  const operations = {
    listFlows: vi.fn(async () => [flow]),
    start: vi.fn(async function* () {}),
    answer: vi.fn(async () => true), cancel: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
    createAccount: vi.fn(async () => {}), removeAccount: vi.fn(async () => {}),
  } satisfies AuthorizationSectionInjected
  render(<AuthorizationSection {...({} as GlobalStandardProps)} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key} close={() => {}} openSection={openSection} />)
  expect(await screen.findByText('Codex', { selector: 'strong' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: en.models }))
  expect(openSection).toHaveBeenCalledWith('models')
})

it('hides API-key-only flows and keeps only OAuth on mixed flows', async () => {
  const keyOnly: FlowView = { key: credentialKey('llm-pi-ai', 'aaa-key-only'), label: 'Key Only', methods: [{ id: 'api-key', label: 'API key' }], inFlight: false, signedIn: false }
  const mixed: FlowView = { key: credentialKey('llm-pi-ai', 'mixed'), label: 'Mixed Provider', methods: [{ id: 'api-key', label: 'API key' }, { id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: false }
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => [keyOnly, mixed]),
    start: vi.fn(async function* () {
      yield { attemptId: brandString<AttemptId>('one'), type: 'notice' as const, message: 'Enter this code', url: 'https://auth.example.test/device', code: 'WXYZ-1234' }
      await new Promise(() => {})
    }),
    answer: vi.fn(async () => true),
    cancel: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    createAccount: vi.fn(async () => {}), removeAccount: vi.fn(async () => {}),
  }
  render(<AuthorizationSection {...({} as GlobalStandardProps)} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key} close={() => {}} openSection={() => {}} />)
  expect(await screen.findByText('Mixed Provider', { selector: 'strong' })).toBeTruthy()
  expect(screen.queryByText('Key Only', { selector: 'strong' })).toBeNull()
  const cards = screen.getAllByRole('listitem')
  expect(cards).toHaveLength(1)
  expect(within(cards[0] as HTMLElement).queryByLabelText(en.method)).toBeNull()
  fireEvent.click(within(cards[0] as HTMLElement).getByRole('button', { name: en.signIn }))
  const code = await screen.findByText('WXYZ-1234')
  expect(cards[0]?.contains(code)).toBe(true)
  await waitFor(() => { expect(operations.start).toHaveBeenCalledWith({ key: mixed.key, method: 'oauth' }, expect.any(AbortSignal)) })
})

it('lists OpenAI Codex first and preserves the remaining OAuth order', async () => {
  const first: FlowView = { key: credentialKey('other', 'first'), label: 'First Provider', methods: [{ id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: false }
  const openai: FlowView = { key: credentialKey('llm-pi-ai', 'openai-codex'), label: 'OpenAI Codex', methods: [{ id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: false }
  const last: FlowView = { key: credentialKey('other', 'last'), label: 'Last Provider', methods: [{ id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: false }
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => [first, openai, last]),
    start: vi.fn(async function* () {}), answer: vi.fn(async () => true),
    cancel: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
    createAccount: vi.fn(async () => {}), removeAccount: vi.fn(async () => {}),
  }
  render(<AuthorizationSection {...({} as GlobalStandardProps)} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key} close={() => {}} openSection={() => {}} />)
  await screen.findByText('OpenAI Codex', { selector: 'strong' })
  expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([
    expect.stringContaining('OpenAI Codex'), expect.stringContaining('First Provider'), expect.stringContaining('Last Provider'),
  ])
})

it('shows the OAuth empty state when there are no OAuth flows', async () => {
  const operations: AuthorizationSectionInjected = {
    listFlows: vi.fn(async () => [{ key: credentialKey('llm-pi-ai', 'key-only'), label: 'API Provider', methods: [{ id: 'api-key', label: 'API key' }], inFlight: false, signedIn: false }]),
    start: vi.fn(async function* () {}), answer: vi.fn(async () => true),
    cancel: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
    createAccount: vi.fn(async () => {}), removeAccount: vi.fn(async () => {}),
  }
  render(<AuthorizationSection {...({} as GlobalStandardProps)} {...operations}
    t={key => key in en ? en[key as keyof typeof en] : key} close={() => {}} openSection={() => {}} />)
  expect(await screen.findByText(en.empty)).toBeTruthy()
  expect(screen.queryByRole('list')).toBeNull()
})
