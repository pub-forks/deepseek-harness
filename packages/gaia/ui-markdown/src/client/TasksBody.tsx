/** Editable Gaia `.tasks` body for the DSH document preview slot. */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
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

const STATUSES: TaskStatus[] = ['todo', 'to-debate', 'to-plan', 'to-implement', 'in-progress', 'to-review', 'on-hold', 'done', 'canceled']
const STATUS_KEYS: Partial<Record<TaskStatus, MarkdownKey>> = {
  'to-debate': 'statusToDebate', 'to-plan': 'statusToPlan', 'to-implement': 'statusToImplement',
  'in-progress': 'statusInProgress', 'to-review': 'statusToReview', 'on-hold': 'statusOnHold', canceled: 'statusCanceled',
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

function TaskCheck({ completed, onClick, label }: { completed: boolean; onClick?: (() => void) | undefined; label?: string }): ReactNode {
  const check = <span className={`${css.check} ${completed ? css.checkCompleted : ''}`} aria-hidden="true">{completed && <span className={css.checkMark} />}</span>
  return onClick ? <button className={css.iconButton} type="button" onClick={onClick} title={label} aria-label={label}>{check}</button> : check
}

/** Render and edit a parsed task list; invalid JSON remains a read-only raw view. */
export function TasksBody({ content, resourceAddress, useResource, t, tasksRemote }: TasksBodyProps): ReactNode {
  const resource = useResource<'file'>(resourceAddress).value
  const absolutePath = resource?.absolutePath
  const source = content.kind === 'text' ? content.text : ''
  const [text, setText] = useState(source)
  const [version, setVersion] = useState(resource?.version ?? '')
  const [error, setError] = useState('')
  useEffect(() => { setText(source); setVersion(resource?.version ?? ''); setError('') }, [source, resource?.version])
  const result = useMemo(() => parseTasksText(text), [text])
  if (content.kind !== 'text') return null
  const fileTitle = displayName(absolutePath, resourceAddress)
  const today = localDate()
  const editable = Boolean(tasksRemote && absolutePath && version && !result.error)
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
      <p className={css.error} role="status">{t('invalidTasksFile')}</p>
      {error && <p className={css.error} role="alert">{error}</p>}
      <pre className={css.rawFallback}>{text}</pre>
    </div>
  }
  const tasks = result.value.tasks
  const openTasks = tasks.filter(task => !task.completed)
  const completedTasks = tasks.filter(task => task.completed)
  const title = result.value.title?.trim() || fileTitle || t('tasksLabel')
  const row = (task: PreviewTask, index: number): ReactNode => {
    const statusKey = STATUS_KEYS[task.status]
    const statusLabel = statusKey ? t(statusKey) : task.status
    const overdue = !task.completed && task.due !== null && task.due < today
    const toggleComplete = taskOperation(task.id, (value) => { setStatus(value, task.completed ? 'todo' : 'done') })
    const deleteTask = (data: Record<string, unknown>): Record<string, unknown> => {
      const taskItems: unknown[] = Array.isArray(data.tasks) ? data.tasks : []
      return { ...data, tasks: taskItems.filter(value => !isRecord(value) || value.id !== task.id) }
    }
    return <article className={css.task} data-completed={task.completed} key={task.id}>
      <TaskCheck completed={task.completed} onClick={editable ? () => { void perform(toggleComplete) } : undefined} label={t(task.completed ? 'reopenTask' : 'completeTask')} />
      <div className={css.taskContent}>
        <div className={css.titleLine}>
          {/* Keyed on the title so a refresh from disk replaces a stale uncontrolled value instead of writing it back on blur. */}
          {editable ? <input key={task.title} className={css.titleInput} aria-label={t('editTitle')} defaultValue={task.title} onBlur={(event) => {
            const value = event.currentTarget.value
            if (value !== task.title) { void perform(taskOperation(task.id, (raw) => { raw.title = value })) }
          }} />
            : <span className={`${css.taskTitle} ${task.completed ? css.taskTitleCompleted : ''}`}>{task.title || t('untitledTask')}</span>}
          {editable
            ? <button className={css.iconButton} type="button" onClick={() => { void perform(taskOperation(task.id, (raw) => { raw.important = raw.important !== true })) }} title={t('toggleImportant')} aria-label={t('toggleImportant')}><Star size={15} fill={task.important ? 'currentColor' : 'none'} className={task.important ? css.star : undefined} /></button>
            : task.important && <span className={css.star} aria-label={t('important')}>★</span>}
          {editable ? <select className={css.statusSelect} aria-label={t('changeStatus')} value={task.status} onChange={(event) => { const status = event.currentTarget.value as TaskStatus; void perform(taskOperation(task.id, (raw) => { setStatus(raw, status) })) }}>
            {STATUSES.map((status) => {
              const statusLabelKey = STATUS_KEYS[status]
              return <option value={status} key={status}>{statusLabelKey ? t(statusLabelKey) : status}</option>
            })}
          </select> : task.status !== 'todo' && task.status !== 'done' && <span className={css.status}>{statusLabel}</span>}
          {task.due && <time className={`${css.due} ${overdue ? css.overdue : ''}`} dateTime={task.due}>{task.due}</time>}
          {editable && <button className={css.iconButton} type="button" onClick={() => { void perform(deleteTask) }} title={t('deleteTask')} aria-label={t('deleteTask')}><Trash2 size={15} /></button>}
        </div>
        {task.tags.length > 0 && <div className={css.tags}>{task.tags.map((tag, tagIndex) => <span className={css.tag} key={`${index}-${tagIndex}`}>{tag}</span>)}</div>}
        {task.steps.length > 0 && <div className={css.stepsBlock}><div className={css.stepsCount}>{task.steps.length} {t('stepsLabel')}</div><ul className={css.steps}>{task.steps.map((step, stepIndex) => <li className={css.step} key={step.id ?? `${index}-step-${stepIndex}`}>
          <TaskCheck completed={step.completed} onClick={editable ? () => { void perform(taskOperation(task.id, (raw) => {
            const steps = raw.steps
            if (!Array.isArray(steps)) return
            const stepItems: unknown[] = steps
            raw.steps = stepItems.map((item, itemIndex): unknown => {
              const matches = isRecord(item) && (step.id ? item.id === step.id : itemIndex === stepIndex)
              return matches && isRecord(item) ? { ...item, completed: item.completed !== true } : item
            })
          })) } : undefined} label={t('toggleStep')} />
          <span className={step.completed ? css.stepCompleted : undefined}>{step.title || t('untitledTask')}</span>
        </li>)}</ul></div>}
        {task.note && <p className={css.note}>{task.note}</p>}
      </div>
    </article>
  }
  return <div className={css.root} data-gaia-tasks>
    <header className={css.header}><h1 className={css.heading}>{title}</h1><p className={css.counts}><span>{t('openTasks')} {openTasks.length}</span><span>{t('doneTasks')} {completedTasks.length}</span></p></header>
    {error && <p className={css.error} role="alert">{error}</p>}
    <section className={css.taskList} aria-label={t('openTasks')}>{openTasks.map((task, index) => row(task, index))}</section>
    {editable && <button className={css.addButton} type="button" onClick={() => { void perform((data) => {
      const current = Array.isArray(data.tasks) ? data.tasks.filter(isRecord) : []
      const used = new Set(current.map(item => typeof item.id === 'string' ? item.id : ''))
      const now = new Date().toISOString()
      return { ...data, tasks: [...(data.tasks as unknown[]), { id: newId('t', used), title: '', completed: false, status: 'todo', important: false, due: null, note: '', steps: [], createdAt: now, completedAt: null }] }
    }) }} title={t('addTask')} aria-label={t('addTask')}><Plus size={16} />{t('addTask')}</button>}
    <details className={css.completedGroup}><summary className={css.completedHeading}>{t('completedTasks')} <span className={css.completedCount}>{completedTasks.length}</span></summary><section className={css.taskList} aria-label={t('completedTasks')}>{completedTasks.map((task, index) => row(task, index))}</section></details>
  </div>
}
