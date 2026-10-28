/** Read-only Gaia `.tasks` body for the DSH document preview slot. */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MarkdownKey } from './locales.ts'
import css from './TasksBody.module.css'

export type TasksBodyProps = DocumentPreviewProps & PropsLocale<'gaiaMarkdown'>
type TaskStatus = 'todo' | 'to-debate' | 'to-plan' | 'to-implement' | 'in-progress' | 'to-review' | 'on-hold' | 'done' | 'canceled'

interface TaskStep { title: string; completed: boolean }
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
interface ParsedTasks { title?: string; tasks: PreviewTask[] }
type ParseResult = { value: ParsedTasks; error: false } | { value: null; error: true }

const STATUSES = new Set<TaskStatus>(['todo', 'to-debate', 'to-plan', 'to-implement', 'in-progress', 'to-review', 'on-hold', 'done', 'canceled'])
const STATUS_KEYS: Partial<Record<TaskStatus, MarkdownKey>> = {
  'to-debate': 'statusToDebate', 'to-plan': 'statusToPlan', 'to-implement': 'statusToImplement',
  'in-progress': 'statusInProgress', 'to-review': 'statusToReview', 'on-hold': 'statusOnHold', canceled: 'statusCanceled',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTask(value: unknown, index: number): PreviewTask {
  const source = isRecord(value) ? value : {}
  const rawStatus = typeof source.status === 'string' && STATUSES.has(source.status as TaskStatus)
    ? source.status as TaskStatus
    : undefined
  const status: TaskStatus = rawStatus ?? (source.completed === true ? 'done' : 'todo')
  const completed = source.completed === true || status === 'done' || status === 'canceled'
  return {
    id: typeof source.id === 'string' && source.id ? source.id : `task-${index}`,
    title: typeof source.title === 'string' ? source.title : '',
    completed,
    status,
    important: source.important === true,
    due: typeof source.due === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(source.due) ? source.due : null,
    note: typeof source.note === 'string' ? source.note : '',
    steps: Array.isArray(source.steps) ? source.steps.map((step) => {
      const item = isRecord(step) ? step : {}
      return { title: typeof item.title === 'string' ? item.title : '', completed: item.completed === true }
    }) : [],
    tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  }
}

/** Parse a `.tasks` file without trusting its shape; blank files are valid empty lists. */
export function parseTasksText(text: string): ParseResult {
  if (!text.trim()) return { value: { tasks: [] }, error: false }
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { value: null, error: true } }
  if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) return { value: null, error: true }
  const tasks = parsed.tasks.map(parseTask)
  return {
    value: { ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}), tasks },
    error: false,
  }
}

function displayName(path: string | undefined, fallback: string): string {
  const name = path?.split('/').filter(Boolean).at(-1) ?? fallback
  return name.toLowerCase().endsWith('.tasks') ? name.slice(0, -6) : name
}

function localDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function TaskCheck({ completed }: { completed: boolean }): ReactNode {
  return <span className={`${css.check} ${completed ? css.checkCompleted : ''}`} aria-label={completed ? 'Completed' : 'Open'} aria-hidden="true">
    {completed && <span className={css.checkMark} />}
  </span>
}

function TaskRow({ task, index, t, today }: {
  task: PreviewTask
  index: number
  t: (key: MarkdownKey) => string
  today: string
}): ReactNode {
  const statusKey = STATUS_KEYS[task.status]
  const statusLabel = statusKey ? t(statusKey) : task.status
  const overdue = !task.completed && task.due !== null && task.due < today
  return <article className={css.task} data-completed={task.completed}>
    <TaskCheck completed={task.completed} />
    <div className={css.taskContent}>
      <div className={css.titleLine}>
        <span className={`${css.taskTitle} ${task.completed ? css.taskTitleCompleted : ''}`}>
          {task.title || t('untitledTask')}
        </span>
        {task.important && <span className={css.star} aria-label="Important">★</span>}
        {task.status !== 'todo' && task.status !== 'done' && <span className={css.status}>{statusLabel}</span>}
        {task.due && <time className={`${css.due} ${overdue ? css.overdue : ''}`} dateTime={task.due}>{task.due}</time>}
      </div>
      {task.tags.length > 0 && <div className={css.tags}>{task.tags.map((tag, tagIndex) => <span className={css.tag} key={`${index}-${tagIndex}`}>{tag}</span>)}</div>}
      {task.steps.length > 0 && <div className={css.stepsBlock}>
        <div className={css.stepsCount}>{task.steps.length} {t('stepsLabel')}</div>
        <ul className={css.steps}>{task.steps.map((step, stepIndex) => <li className={css.step} key={`${index}-step-${stepIndex}`}>
          <TaskCheck completed={step.completed} />
          <span className={step.completed ? css.stepCompleted : undefined}>{step.title || t('untitledTask')}</span>
        </li>)}</ul>
      </div>}
      {task.note && <p className={css.note}>{task.note}</p>}
    </div>
  </article>
}

/** Render text pages as a safe, read-only task list or raw-text fallback. */
export function TasksBody({ content, resourceAddress, useResource, t }: TasksBodyProps): ReactNode {
  const resource = useResource<'file'>(resourceAddress).value
  const absolutePath = resource?.absolutePath
  const source = content.kind === 'text' ? content.text : ''
  const result = useMemo(() => parseTasksText(source), [source])
  if (content.kind !== 'text') return null
  const fileTitle = displayName(absolutePath, resourceAddress)
  const today = localDate()

  if (result.error) {
    return <div className={css.root} data-gaia-tasks>
      <p className={css.error} role="status">{t('invalidTasksFile')}</p>
      <pre className={css.rawFallback}>{source}</pre>
    </div>
  }

  const tasks = result.value.tasks
  const openTasks = tasks.filter(task => !task.completed)
  const completedTasks = tasks.filter(task => task.completed)
  const title = result.value.title?.trim() || fileTitle || t('tasksLabel')
  return <div className={css.root} data-gaia-tasks>
    <header className={css.header}>
      <h1 className={css.heading}>{title}</h1>
      <p className={css.counts}><span>{t('openTasks')} {openTasks.length}</span><span>{t('doneTasks')} {completedTasks.length}</span></p>
    </header>
    <section className={css.taskList} aria-label={t('openTasks')}>
      {openTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} t={t} today={today} />)}
    </section>
    <details className={css.completedGroup}>
      <summary className={css.completedHeading}>{t('completedTasks')} <span className={css.completedCount}>{completedTasks.length}</span></summary>
      <section className={css.taskList} aria-label={t('completedTasks')}>
        {completedTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} t={t} today={today} />)}
      </section>
    </details>
  </div>
}
