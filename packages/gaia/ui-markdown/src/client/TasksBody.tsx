/** Editable Gaia `.tasks` body for the DSH document preview slot, styled after Gaia's Cockpit task list. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Check, CheckCircle2, ChevronRight, Circle, CircleDashed, CircleSlash, ClipboardList, Code2, Eye,
  MessagesSquare, PauseCircle, Plus, Star, Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MarkdownKey } from './locales.ts'
import css from './TasksBody.module.css'

export type TasksBodyProps = DocumentPreviewProps & PropsLocale<'gaiaMarkdown'> & {
  readonly tasksRemote?: {
    write(
      sessionId: ReturnType<typeof SessionId>, path: string, content: string,
      expectedVersion: string, signal: AbortSignal,
    ): Promise<{ version: string }>
    read(sessionId: ReturnType<typeof SessionId>, path: string, signal: AbortSignal): Promise<{ text: string; version: string }>
  }
}
type TaskStatus = 'todo' | 'to-debate' | 'to-plan' | 'to-implement' | 'in-progress' | 'to-review' | 'on-hold' | 'done' | 'canceled'
interface TaskStep {
  id?: string
  title: string
  completed: boolean
}
interface PreviewTask {
  id: string
  title: string
  completed: boolean
  status: TaskStatus
  important: boolean
  due: string | null
  note: string
  steps: TaskStep[]
  tags: string[]
}
interface ParsedTasks {
  raw: Record<string, unknown>
  tasks: PreviewTask[]
  title?: string
}
type ParseResult = { value: ParsedTasks; error: false } | { value: null; error: true }
type Operation = (data: Record<string, unknown>) => Record<string, unknown>
type Translate = TasksBodyProps['t']

const STATUSES: TaskStatus[] = ['todo', 'to-debate', 'to-plan', 'to-implement', 'in-progress', 'to-review', 'on-hold', 'done', 'canceled']

function isGaiaFrame(): boolean {
  return typeof window !== 'undefined' && window.parent !== window &&
    (document.documentElement.hasAttribute('data-gaia-full') || document.documentElement.hasAttribute('data-gaia-embed'))
}

function isAbsoluteTasksPath(path: string | undefined): path is string {
  return typeof path === 'string' && path.length > 0 && path.length <= 4096 && path.startsWith('/') && path.endsWith('.tasks') &&
    !/[\u0000-\u001f\u007f]/u.test(path) &&
    !path.split('/').some(segment => segment === '.' || segment === '..')
}
/** Same labels, icons, and colors as Gaia's `TASK_STATUSES`. */
const STATUS_META: Record<TaskStatus, { key: MarkdownKey; icon: LucideIcon; color: string }> = {
  todo: { key: 'statusTodo', icon: Circle, color: 'var(--tasks-muted-fg)' },
  'to-debate': { key: 'statusToDebate', icon: MessagesSquare, color: '#ec4899' },
  'to-plan': { key: 'statusToPlan', icon: ClipboardList, color: '#8b5cf6' },
  'to-implement': { key: 'statusToImplement', icon: Code2, color: '#f97316' },
  'in-progress': { key: 'statusInProgress', icon: CircleDashed, color: '#3b82f6' },
  'to-review': { key: 'statusToReview', icon: Eye, color: '#0ea5e9' },
  'on-hold': { key: 'statusOnHold', icon: PauseCircle, color: '#f59e0b' },
  done: { key: 'statusDone', icon: CheckCircle2, color: '#10b981' },
  canceled: { key: 'statusCanceled', icon: CircleSlash, color: '#ef4444' },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTask(value: unknown, index: number): PreviewTask {
  const source = isRecord(value) ? value : {}
  const rawStatus = typeof source.status === 'string' && STATUSES.includes(source.status as TaskStatus) ? source.status as TaskStatus : undefined
  const status: TaskStatus = rawStatus === 'canceled' ? 'canceled' : source.completed === true ? 'done' : rawStatus ?? 'todo'
  const completed = source.completed === true || status === 'done' || status === 'canceled'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : `task-${index}`,
    title: typeof source.title === 'string' ? source.title : '', completed, status, important: source.important === true,
    due: typeof source.due === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(source.due) ? source.due : null,
    note: typeof source.note === 'string' ? source.note : '',
    steps: Array.isArray(source.steps) ? source.steps.map((step) => {
      const item = isRecord(step) ? step : {}
      return { ...(typeof item.id === 'string' ? { id: item.id } : {}), title: typeof item.title === 'string' ? item.title : '', completed: item.completed === true }
    }) : [],
    tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  }
}

/** Parse a `.tasks` file while retaining its original object for minimal edits. */
export function parseTasksText(text: string): ParseResult {
  let parsed: unknown
  try { parsed = text.trim() ? JSON.parse(text) : { version: 1, tasks: [] } } catch { return { value: null, error: true } }
  if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) return { value: null, error: true }
  return { value: { raw: parsed, ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}), tasks: parsed.tasks.map(parseTask) }, error: false }
}

/** The complete file text: bytes from a `bytes-complete` load, or text pages (only whole once `eof`). */
function contentText(content: TasksBodyProps['content']): string | undefined {
  if (content.kind === 'bytes') {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(content.data) } catch { return undefined }
  }
  return content.kind === 'text' ? content.text : undefined
}

function displayName(path: string | undefined, fallback: string): string {
  const name = path?.split('/').filter(Boolean).at(-1) ?? fallback
  return name.toLowerCase().endsWith('.tasks') ? name.slice(0, -6) : name
}
function localDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function newId(prefix: 't' | 's', used: Set<string>): string {
  let id = ''
  do {
    const bytes = crypto.getRandomValues(new Uint8Array(5))
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    id = `${prefix}_${hex}`
  } while (used.has(id))
  return id
}
function setStatus(task: Record<string, unknown>, status: TaskStatus): void {
  task.status = status
  const finished = status === 'done' || status === 'canceled'
  task.completed = finished
  task.completedAt = finished ? new Date().toISOString() : null
}
function editById(data: Record<string, unknown>, id: string, edit: (task: Record<string, unknown>) => void): Record<string, unknown> {
  const tasks = data.tasks
  if (!Array.isArray(tasks)) return data
  const index = tasks.findIndex(item => isRecord(item) && item.id === id)
  if (index < 0 || !isRecord(tasks[index])) return data
  const changed = tasks.slice()
  const task = { ...tasks[index] }
  edit(task)
  changed[index] = task
  return { ...data, tasks: changed }
}
function taskOperation(id: string, operation: (task: Record<string, unknown>) => void): Operation {
  return data => editById(data, id, operation)
}

/** Gaia's `RoundCheck`: an orange disc with a check mark once completed. */
function RoundCheck({ completed, onClick, label, small }: {
  completed: boolean
  onClick?: (() => void) | undefined
  label: string
  small?: boolean
}): ReactNode {
  const className = `${css.check} ${small ? css.checkSmall : ''} ${completed ? css.checkCompleted : ''}`
  const mark = completed && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M2.5 6.5L5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  return onClick
    ? <button className={className} type="button" role="checkbox" aria-checked={completed} title={label} aria-label={label} onClick={(event) => { event.stopPropagation(); onClick() }}>{mark}</button>
    : <span className={className} role="checkbox" aria-checked={completed} aria-label={label} aria-readonly="true">{mark}</span>
}

function StatusIcon({ status }: { status: TaskStatus }): ReactNode {
  const { icon: Icon, color } = STATUS_META[status]
  return <Icon size={14} style={{ color }} aria-hidden="true" />
}

/** Gaia's icon-variant `StatusPicker`: the status icon opens a menu of every status. */
function StatusMenu({ status, onChange, t }: {
  status: TaskStatus
  onChange?: ((status: TaskStatus) => void) | undefined
  t: Translate
}): ReactNode {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const label = t(STATUS_META[status].key)
  if (!onChange) return <span className={css.statusIcon} title={label} aria-label={label} role="img"><StatusIcon status={status} /></span>
  return <span className={css.statusMenuRoot} ref={rootRef} onClick={(event) => { event.stopPropagation() }}>
    <button className={css.iconButton} type="button" title={label} aria-label={`${t('changeStatus')}: ${label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(value => !value) }}>
      <StatusIcon status={status} />
    </button>
    {open && <span className={css.statusMenu} role="menu">
      {STATUSES.map(value => <button key={value} className={css.statusMenuItem} type="button" role="menuitemradio" aria-checked={value === status} onClick={() => { setOpen(false); if (value !== status) onChange(value) }}>
        <span className={css.statusMenuLabel}><StatusIcon status={value} />{t(STATUS_META[value].key)}</span>
        {value === status && <Check size={14} className={css.accent} aria-hidden="true" />}
      </button>)}
    </span>}
  </span>
}

/** Inline title: a plain label; a double click edits it, committed on Enter or blur and reverted on Escape. */
function TaskTitle({ task, onRename, t }: {
  task: PreviewTask
  onRename?: ((title: string) => void) | undefined
  t: Translate
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  const className = `${css.taskTitle} ${task.completed ? css.taskTitleCompleted : ''} ${task.title ? '' : css.untitled}`
  if (!editing || !onRename) {
    return <span className={className} onDoubleClick={onRename ? (event) => { event.stopPropagation(); setEditing(true) } : undefined}>{task.title || t('untitledTask')}</span>
  }
  const commit = (value: string): void => { setEditing(false); if (value !== task.title) onRename(value) }
  return <input ref={inputRef} className={`${css.titleInput} ${task.completed ? css.taskTitleCompleted : ''}`} aria-label={t('editTitle')} defaultValue={task.title} placeholder={t('untitledTask')}
    onClick={(event) => { event.stopPropagation() }}
    onBlur={(event) => { commit(event.currentTarget.value) }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); commit(event.currentTarget.value) }
      else if (event.key === 'Escape') { event.preventDefault(); setEditing(false) }
    }} />
}

/** Render and edit a parsed task list; invalid JSON remains a read-only raw view. */
export function TasksBody({ content, resourceAddress, useResource, t, tasksRemote }: TasksBodyProps): ReactNode {
  const resource = useResource<'file'>(resourceAddress).value
  const absolutePath = resource?.absolutePath
  const [gaiaFrame, setGaiaFrame] = useState(isGaiaFrame)
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => { setGaiaFrame(isGaiaFrame()) })
    observer.observe(root, { attributes: true, attributeFilter: ['data-gaia-full', 'data-gaia-embed'] })
    return () => { observer.disconnect() }
  }, [])
  const source = contentText(content)
  // A text-pages load holds only its first pages until `eof`; a partial file is not invalid, just incomplete.
  const partial = content.kind === 'text' && !content.eof
  const [text, setText] = useState(source ?? '')
  const [version, setVersion] = useState(resource?.version ?? '')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => { setText(source ?? ''); setVersion(resource?.version ?? ''); setError('') }, [source, resource?.version])
  const result = useMemo(() => parseTasksText(text), [text])
  if (gaiaFrame && isAbsoluteTasksPath(absolutePath)) {
    const src = new URL(`/embed/tasks?path=${encodeURIComponent(absolutePath)}`, window.location.origin).toString()
    const title = absolutePath.split('/').at(-1) ?? absolutePath
    return <div className={css.embedRoot} data-gaia-tasks-embed>
      <iframe key={absolutePath} className={css.embedFrame} src={src} title={title} />
    </div>
  }
  if (source === undefined) return null
  const fileTitle = displayName(absolutePath, resourceAddress)
  const today = localDate()
  const editable = Boolean(tasksRemote && absolutePath && version && !result.error && !partial)
  const sessionId = SessionId(decodeURIComponent(/^dsh-resource:\/\/file\/session\/([^/]+)/u.exec(resourceAddress)?.[1] ?? ''))

  const perform = async (operation: Operation): Promise<void> => {
    if (!tasksRemote || !absolutePath || !version || result.error) return
    const controller = new AbortController()
    setError('')
    try {
      let data = operation(result.value.raw)
      try {
        const saved = await tasksRemote.write(sessionId, absolutePath, JSON.stringify(data, null, 2), version, controller.signal)
        setText(JSON.stringify(data, null, 2)); setVersion(saved.version)
      } catch (cause) {
        if (!isRecord(cause) || cause.code !== 'gaia-tasks/stale') throw cause
        const fresh = await tasksRemote.read(sessionId, absolutePath, controller.signal)
        setText(fresh.text); setVersion(fresh.version)
        const latest = parseTasksText(fresh.text)
        if (latest.error) { setError(t('staleInvalidFile')); return }
        data = operation(latest.value.raw)
        const saved = await tasksRemote.write(sessionId, absolutePath, JSON.stringify(data, null, 2), fresh.version, controller.signal)
        setText(JSON.stringify(data, null, 2)); setVersion(saved.version)
      }
    } catch { setError(t('saveFailed')) }
  }

  if (result.error) {
    return <div className={css.root} data-gaia-tasks>
      <p className={partial ? css.notice : css.error} role="status">{t(partial ? 'tasksFileIncomplete' : 'invalidTasksFile')}</p>
      {error && <p className={css.error} role="alert">{error}</p>}
      <pre className={css.rawFallback}>{text}</pre>
    </div>
  }
  const tasks = result.value.tasks
  const openTasks = tasks.filter(task => !task.completed)
  const important = openTasks.filter(task => task.important)
  const others = openTasks.filter(task => !task.important)
  const completedTasks = tasks.filter(task => task.completed)
  const title = result.value.title?.trim() || fileTitle || t('tasksLabel')
  const addTask = (): void => {
    const value = draft.trim()
    if (!value) return
    setDraft('')
    void perform((data) => {
      const current: unknown[] = Array.isArray(data.tasks) ? data.tasks : []
      const used = new Set(current.filter(isRecord).map(item => typeof item.id === 'string' ? item.id : ''))
      const now = new Date().toISOString()
      return {
        ...data,
        tasks: [...current, {
          id: newId('t', used), title: value, completed: false, status: 'todo', important: false,
          due: null, note: '', steps: [], createdAt: now, completedAt: null,
        }],
      }
    })
  }

  const row = (task: PreviewTask, index: number): ReactNode => {
    const overdue = !task.completed && task.due !== null && task.due < today
    const isExpanded = expanded === task.id
    const hasDetails = task.steps.length > 0 || task.tags.length > 0 || task.note.length > 0
    const doneSteps = task.steps.filter(step => step.completed).length
    const edit = (operation: (raw: Record<string, unknown>) => void): void => { void perform(taskOperation(task.id, operation)) }
    const deleteTask = (data: Record<string, unknown>): Record<string, unknown> => {
      const taskItems: unknown[] = Array.isArray(data.tasks) ? data.tasks : []
      return { ...data, tasks: taskItems.filter(value => !isRecord(value) || value.id !== task.id) }
    }
    const toggleStep = (step: TaskStep, stepIndex: number): void => {
      edit((raw) => {
        const steps = raw.steps
        if (!Array.isArray(steps)) return
        const stepItems: unknown[] = steps
        raw.steps = stepItems.map((item, itemIndex): unknown => {
          const matches = isRecord(item) && (step.id ? item.id === step.id : itemIndex === stepIndex)
          return matches && isRecord(item) ? { ...item, completed: item.completed !== true } : item
        })
      })
    }
    return <article className={css.task} data-completed={task.completed} data-expanded={isExpanded} key={task.id}>
      <div className={css.taskRow}
        onClick={hasDetails ? () => { setExpanded(isExpanded ? null : task.id) } : undefined}
        data-clickable={hasDetails}>
        <RoundCheck completed={task.completed}
          onClick={editable ? () => { edit((raw) => { setStatus(raw, task.completed ? 'todo' : 'done') }) } : undefined}
          label={t(task.completed ? 'reopenTask' : 'completeTask')} />
        <span className={css.titleCell}>
          <TaskTitle task={task} t={t}
            onRename={editable ? (value) => { edit((raw) => { raw.title = value }) } : undefined} />
        </span>
        {hasDetails && <ChevronRight size={14} className={`${css.chevron} ${isExpanded ? css.chevronOpen : ''}`} aria-hidden="true" />}
        {task.steps.length > 0 && <span className={css.meta} title={`${task.steps.length} ${t('stepsLabel')}`}>{doneSteps}/{task.steps.length}</span>}
        {task.status !== 'done' && <StatusMenu status={task.status} t={t} onChange={editable ? (status) => { edit((raw) => { setStatus(raw, status) }) } : undefined} />}
        {task.due && <time className={`${css.due} ${overdue ? css.overdue : ''}`} dateTime={task.due}>{task.due}</time>}
        {editable
          ? <button className={`${css.iconButton} ${task.important ? css.star : css.faint}`} type="button" onClick={(event) => { event.stopPropagation(); edit((raw) => { raw.important = raw.important !== true }) }} title={t('toggleImportant')} aria-label={t('toggleImportant')} aria-pressed={task.important}><Star size={16} fill={task.important ? 'currentColor' : 'none'} /></button>
          : task.important && <Star size={16} fill="currentColor" className={css.star} aria-label={t('important')} role="img" />}
        {editable && <button className={`${css.iconButton} ${css.faint} ${css.delete}`} type="button" onClick={(event) => { event.stopPropagation(); void perform(deleteTask) }} title={t('deleteTask')} aria-label={t('deleteTask')}><Trash2 size={16} /></button>}
      </div>
      {isExpanded && <div className={css.details}>
        {task.tags.length > 0 && <div className={css.tags}>{task.tags.map((tag, tagIndex) => <span className={css.tag} key={`${index}-${tagIndex}`}>#{tag}</span>)}</div>}
        {task.steps.length > 0 && <ul className={css.steps} aria-label={t('stepsLabel')}>{task.steps.map((step, stepIndex) => <li className={css.step} key={step.id ?? `${index}-step-${stepIndex}`}>
          <RoundCheck small completed={step.completed} onClick={editable ? () => { toggleStep(step, stepIndex) } : undefined} label={t('toggleStep')} />
          <span className={step.completed ? css.stepCompleted : undefined}>{step.title || t('untitledTask')}</span>
        </li>)}</ul>}
        {task.note && <p className={css.note}>{task.note}</p>}
      </div>}
    </article>
  }
  return <div className={css.root} data-gaia-tasks>
    <header className={css.header}>
      <h1 className={css.heading}>{title}</h1>
      <p className={css.counts}>{openTasks.length} {t(openTasks.length === 1 ? 'taskRemaining' : 'tasksRemaining')}</p>
    </header>
    {error && <p className={css.error} role="alert">{error}</p>}
    {editable && <div className={css.addRow}>
      <label className={css.addField}>
        <Plus size={16} className={css.faint} aria-hidden="true" />
        <input className={css.addInput} value={draft} placeholder={t('addTask')} aria-label={t('addTask')}
          onChange={(event) => { setDraft(event.currentTarget.value) }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTask() } }} />
      </label>
    </div>}
    <div className={css.list}>
      {important.length > 0 && <details className={`${css.group} ${css.importantGroup}`} open>
        <summary className={`${css.groupHeading} ${css.star}`}><ChevronRight size={14} className={css.groupChevron} aria-hidden="true" /><Star size={14} fill="currentColor" aria-hidden="true" />{t('important')} ({important.length})</summary>
        <section className={css.taskList} aria-label={t('important')}>{important.map((task, index) => row(task, index))}</section>
      </details>}
      <section className={css.taskList} aria-label={t('openTasks')}>{others.map((task, index) => row(task, important.length + index))}</section>
      {completedTasks.length > 0 && <details className={`${css.group} ${css.completedGroup}`}>
        <summary className={css.groupHeading}><ChevronRight size={14} className={css.groupChevron} aria-hidden="true" />{t('completedTasks')} ({completedTasks.length})</summary>
        <section className={css.taskList} aria-label={t('completedTasks')}>{completedTasks.map((task, index) => row(task, index))}</section>
      </details>}
    </div>
  </div>
}
