/** Generic sign-in Settings page over the Gaia authorization Remote. */
import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttemptId, AttemptItem, FlowView, PromptId, StartRequest } from '@deepseek-ai/dsh-gaia-api-authorization/types'
import css from './AuthorizationSection.module.css'

/** Operations supplied by the browser plugin without exposing Cordis to React. */
export interface AuthorizationSectionInjected {
  listFlows: () => Promise<FlowView[]>
  start: (request: StartRequest, signal: AbortSignal) => AsyncIterable<AttemptItem>
  answer: (attemptId: AttemptId, promptId: PromptId, value: string) => Promise<boolean>
  cancel: (attemptId: AttemptId) => Promise<void>
  signOut: (key: FlowView['key']) => Promise<void>
  createAccount: (source: string, accountId: string, label: string) => Promise<void>
  removeAccount: (key: FlowView['key']) => Promise<void>
}
export type AuthorizationSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.gaiaAuthorization'> & InjectFace<AuthorizationSectionInjected>

/** Prefer a declared device method; pi-ai's Codex method picker is handled below. */
export function preferredMethod(flow: FlowView): string {
  return flow.methods.find(method => /device/i.test(`${method.id} ${method.label}`))?.id ?? flow.methods[0]?.id ?? ''
}

/** @param props - localized Remote operations. @returns the generic sign-in page. */
export function AuthorizationSection({
  t, listFlows, start, answer, cancel, signOut, createAccount, removeAccount, openSection,
}: AuthorizationSectionProps) {
  const [flows, setFlows] = useState<FlowView[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [localCancelled, setLocalCancelled] = useState(false)
  const [selected, setSelected] = useState<FlowView>()
  const [method, setMethod] = useState('')
  const [items, setItems] = useState<AttemptItem[]>([])
  const [promptValue, setPromptValue] = useState('')
  const [confirmKey, setConfirmKey] = useState<FlowView['key']>()
  const [removeKey, setRemoveKey] = useState<FlowView['key']>()
  const [accountId, setAccountId] = useState('')
  const [accountLabel, setAccountLabel] = useState('')
  const [accountSource, setAccountSource] = useState('openai-codex')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const stream = useRef<AbortController | undefined>(undefined)
  const load = async () => {
    try { setFlows(await listFlows()); setFailed(false) } catch (error: unknown) { console.warn('gaia-authorization: listing sign-in flows failed', error); setFailed(true) } finally { setLoading(false) }
  }
  useEffect(() => { void load(); return () => { stream.current?.abort() } }, [])
  const begin = async (flow: FlowView, chosen: string) => {
    stream.current?.abort()
    const controller = new AbortController()
    stream.current = controller
    setSelected(flow); setMethod(chosen); setItems([]); setPromptValue(''); setActionError(false); setLocalCancelled(false); setBusy(true)
    try {
      for await (const item of start({ key: flow.key, method: chosen }, controller.signal)) {
        if (item.type === 'withdrawn' || item.type === 'done' || item.type === 'error') setPromptValue('')
        setItems(previous => item.type === 'withdrawn' ? [...previous.filter(row => row.type !== 'prompt' || row.promptId !== item.promptId), item] : [...previous, item])
      }
    } catch { if (!controller.signal.aborted) setActionError(true) }
    finally { setBusy(false); void load() }
  }
  const activePrompt = [...items].reverse().find(item => item.type === 'prompt')
  const prompt = activePrompt?.type === 'prompt' ? activePrompt : undefined
  const terminal = [...items].reverse().find(item => item.type === 'done' || item.type === 'error')
  const attemptId = items[0]?.attemptId
  const copy = (value: string) => { void navigator.clipboard.writeText(value).then(() => { setCopied(true) }, () => { setCopied(false) }) }
  const safeUrl = (value: string): boolean => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }
  const submitAccount = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!accountSource || busy) return
    setBusy(true)
    setActionError(false)
    try {
      await createAccount(accountSource, accountId, accountLabel)
      await load()
    } catch {
      setActionError(true)
    } finally {
      setBusy(false)
    }
  }
  const confirmRemove = async (): Promise<void> => {
    const key = removeKey
    setRemoveKey(undefined)
    if (key === undefined) return
    try {
      await removeAccount(key)
      await load()
    } catch {
      setActionError(true)
    }
  }
  const submit = async () => {
    if (prompt === undefined) return
    const value = prompt.kind === 'select' ? (promptValue || (selected?.key === 'llm-pi-ai/openai-codex' ? prompt.options?.find(option => /device/i.test(`${option.id} ${option.label}`))?.id : undefined) || prompt.options?.[0]?.id || '') : promptValue
    if (value.length === 0) return
    try {
      if (!await answer(prompt.attemptId, prompt.promptId, value)) throw new Error('prompt was withdrawn')
      setItems(previous => previous.filter(item => item !== prompt))
      setPromptValue('')
    } catch {
      setItems(previous => previous.filter(item => item !== prompt))
      setActionError(true)
    }
  }
  // The attempt panel renders inside the card of the flow being signed into:
  // with dozens of providers listed, a panel after the list is off-screen and
  // the Sign in click looks like it did nothing.
  // A cancelled or finished attempt must not leave its last question or an
  // expired device code behind.
  const showPrompt = terminal === undefined && !localCancelled
  const panel = selected === undefined ? null : <div className={css.panel} role="status">
    {showPrompt && items.filter((item): item is Extract<AttemptItem, { type: 'notice' }> => item.type === 'notice').map((item, index) => <div key={index} className={css.notice}>
      <p>{item.message}</p>
      {item.url && safeUrl(item.url) && <div className={css.actions}><a href={item.url} target="_blank" rel="noopener noreferrer">{t('open')}</a><Button variant="outline" onClick={() => { copy(item.url as string) }}>{t(copied ? 'copied' : 'copy')}</Button></div>}
      {item.code && <div className={css.actions}><code className={css.code}>{item.code}</code><Button variant="outline" onClick={() => { copy(item.code as string) }}>{t(copied ? 'copied' : 'copy')}</Button></div>}
    </div>)}
    {showPrompt && prompt && <form onSubmit={(event) => { event.preventDefault(); void submit() }} className={css.prompt}>
      <label>{prompt.message}
        {prompt.kind === 'select' ? <select value={promptValue || (selected.key === 'llm-pi-ai/openai-codex' ? prompt.options?.find(option => /device/i.test(`${option.id} ${option.label}`))?.id : undefined) || prompt.options?.[0]?.id || ''} onChange={(event) => { setPromptValue(event.target.value) }}>{prompt.options?.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <input type={prompt.kind === 'secret' ? 'password' : 'text'} value={promptValue} placeholder={prompt.placeholder} onChange={(event) => { setPromptValue(event.target.value) }} />}
      </label><Button variant="primary" onClick={() => { void submit() }}>{t('submit')}</Button>
    </form>}
    {terminal?.type === 'done' && <p>{t(terminal.outcome === 'authorized' ? 'authorized' : 'cancelled')}</p>}
    {localCancelled && <p>{t('cancelled')}</p>}
    {terminal?.type === 'error' && <p role="alert">{t(terminal.message === 'busy' ? 'busy' : 'error')}</p>}
    {terminal?.type === 'done' && terminal.outcome === 'authorized' && <p>{t('modelsHint')} <a href="#settings/models" onClick={(event) => { event.preventDefault(); openSection?.('models') }}>{t('models')}</a></p>}
    {busy && <Button variant="outline" onClick={() => { setPromptValue(''); if (attemptId) void cancel(attemptId).catch(() => { setActionError(true) }); else { stream.current?.abort(); setLocalCancelled(true) } }}>{t('cancel')}</Button>}
  </div>
  // Keep catalog order except that OpenAI Codex is the first OAuth sign-in.
  const oauthFlows = flows
    .map(flow => ({ ...flow, methods: flow.methods.filter(method => method.id === 'oauth') }))
    .filter(flow => flow.methods.length > 0)
  const ordered = [...oauthFlows].sort((a, b) => Number(b.key === 'llm-pi-ai/openai-codex') - Number(a.key === 'llm-pi-ai/openai-codex'))
  const accountSources = ordered.filter(flow => !flow.accountAlias && flow.key.startsWith('llm-pi-ai/'))
  const sourceValue = accountSources.some(flow => flow.key === `llm-pi-ai/${accountSource}`)
    ? accountSource
    : accountSources[0]?.key.slice('llm-pi-ai/'.length) ?? ''
  return <section className={css.section} aria-label={t('nav')}>
    <h2>{t('title')}</h2><p className={css.intro}>{t('intro')}</p>
    <p>{t('apiKeyHint')} <a href="#settings/models" onClick={(event) => { event.preventDefault(); openSection?.('models') }}>{t('models')}</a></p>
    <form className={css.actions} onSubmit={(event) => { void submitAccount(event) }}>
      <label>{t('accountSource')}
        <select value={sourceValue} onChange={(event) => { setAccountSource(event.target.value) }}>
          {accountSources.map(flow => <option key={flow.key} value={flow.key.slice('llm-pi-ai/'.length)}>{flow.label}</option>)}
        </select>
      </label>
      <label>{t('accountLabel')} <input value={accountLabel} maxLength={80} onChange={(event) => { setAccountLabel(event.target.value) }} required /></label>
      <label>{t('accountId')} <input value={accountId} maxLength={48} pattern="[a-z][a-z0-9-]{1,47}" onChange={(event) => { setAccountId(event.target.value) }} required /></label>
      <Button type="submit" variant="primary" disabled={busy || accountSources.length === 0}>{t('addAccount')}</Button>
    </form>
    {loading ? <p>{t('loading')}</p> : failed ? <p role="alert">{t('failed')}</p> : ordered.length === 0 ? <p>{t('empty')}</p> :
      <ul className={css.list}>{ordered.map(flow => <li key={flow.key} className={css.card}>
        <div className={css.row}><strong>{flow.label}</strong><span className={css.status}>{t(flow.signedIn ? 'signedIn' : 'signedOut')}{flow.expiresAt === undefined ? '' : ` · ${t('expires')} ${new Date(flow.expiresAt).toLocaleString()}`}</span></div>
        <div className={css.actions}>
          {flow.methods.length > 1 && <label>{t('method')} <select value={selected?.key === flow.key ? method : preferredMethod(flow)} onChange={(event) => { setSelected(flow); setMethod(event.target.value) }}>{flow.methods.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
          <Button variant="primary" disabled={flow.inFlight || busy} onClick={() => { void begin(flow, selected?.key === flow.key && method ? method : preferredMethod(flow)) }}>{t('signIn')}</Button>
          {flow.signedIn && <Button variant="outline" disabled={busy} onClick={() => { setConfirmKey(flow.key) }}>{t('signOut')}</Button>}
          {flow.accountAlias && <Button variant="outline" disabled={flow.inFlight || busy} onClick={() => { setRemoveKey(flow.key) }}>{t('removeAccount')}</Button>}
        </div>
        {selected?.key === flow.key && (busy || items.length > 0 || localCancelled) && panel}
      </li>)}</ul>}
    {actionError && <p role="alert">{t('error')}</p>}
    <Modal open={confirmKey !== undefined} onClose={() => { setConfirmKey(undefined) }} title={t('confirmTitle')} description={t('confirmDescription')} closeLabel={t('close')} footer={<><Button variant="outline" onClick={() => { setConfirmKey(undefined) }}>{t('cancel')}</Button><Button variant="primary" onClick={() => { const key = confirmKey; setConfirmKey(undefined); if (key) void signOut(key).then(load).catch(() => { setActionError(true) }) }}>{t('signOut')}</Button></>} />
    <Modal open={removeKey !== undefined} onClose={() => { setRemoveKey(undefined) }} title={t('removeTitle')} description={t('removeDescription')} closeLabel={t('close')} footer={<><Button variant="outline" onClick={() => { setRemoveKey(undefined) }}>{t('cancel')}</Button><Button variant="primary" onClick={() => { void confirmRemove() }}>{t('removeAccount')}</Button></>} />
  </section>
}
