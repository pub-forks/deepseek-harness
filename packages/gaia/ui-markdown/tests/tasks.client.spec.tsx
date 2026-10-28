// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { tasksDefinition, TASKS_BODY_ID } from '../src/client/markdown-definition.ts'
import { parseTasksText, TasksBody } from '../src/client/TasksBody.tsx'
import type { TasksBodyProps } from '../src/client/TasksBody.tsx'
import type { MarkdownKey } from '../src/client/locales.ts'

afterEach(cleanup)
type TestWrite = (sessionId: string, path: string, content: string, version: string, signal: AbortSignal) => Promise<{ version: string }>

const labels: Record<MarkdownKey, string> = {
  label: 'Obsidian', copy: 'Copy', copied: 'Copied', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: 'Read aloud', stopSection: 'Stop reading',
  tasksLabel: 'Tasks', openTasks: 'Open', doneTasks: 'Done', completedTasks: 'Completed', untitledTask: 'Untitled task',
  invalidTasksFile: 'Could not parse this tasks file. Showing the raw text.', stepsLabel: 'steps',
  statusToDebate: 'To Debate', statusToPlan: 'To Plan', statusToImplement: 'To Implement', statusInProgress: 'In Progress', statusToReview: 'To Review', statusOnHold: 'On Hold', statusCanceled: 'Canceled',
  completeTask: 'Mark complete', reopenTask: 'Reopen task', toggleImportant: 'Toggle important', important: 'Important', changeStatus: 'Change status', toggleStep: 'Toggle step', editTitle: 'Edit task title', addTask: 'Add task', deleteTask: 'Delete task', saveFailed: 'Could not save', staleInvalidFile: 'Stale invalid',
}

function props(text: string, path = '/workspace/list.tasks') {
  return {
    content: { kind: 'text' as const, text, pages: [], eof: true },
    resourceAddress: 'dsh-resource://file/session/s1/workspace/list.tasks',
    useResource: () => ({ status: 'ready', value: { absolutePath: path, version: 'v1' } }),
    t: (key: MarkdownKey) => labels[key],
  } as unknown as TasksBodyProps
}

describe('Gaia Tasks document preview', () => {
  it('registers a higher-priority text-pages definition for .tasks', () => {
    expect(tasksDefinition(() => 'Tasks')).toMatchObject({
      id: TASKS_BODY_ID, extensions: ['tasks'], priority: 'extension', loading: 'text-pages', wrap: false,
    })
  })

  it('parses a blank file as an empty list and falls back to the filename for a missing title', () => {
    expect(parseTasksText(' \n\t')).toMatchObject({ value: { tasks: [] }, error: false })
    const { container } = render(<TasksBody {...props('{"tasks":[]}')} />)
    expect(screen.getByRole('heading', { name: 'list' })).toBeTruthy()
    expect(container.querySelector('[data-gaia-tasks]')).not.toBeNull()
  })

  it('derives missing task status from completed', () => {
    expect(parseTasksText('{"tasks":[{"completed":true},{"completed":false}]}')).toMatchObject({
      value: { tasks: [{ status: 'done', completed: true }, { status: 'todo', completed: false }] },
    })
    expect(parseTasksText('{"tasks":[{"completed":true,"status":"in-progress"},{"completed":false,"status":"canceled"}]}')).toMatchObject({
      value: { tasks: [{ status: 'done', completed: true }, { status: 'canceled', completed: true }] },
    })
  })

  it('shows a short error and raw text for invalid JSON or a non-object root', () => {
    for (const text of ['{bad json', '[]']) {
      const { unmount } = render(<TasksBody {...props(text)} />)
      expect(screen.getByRole('status').textContent).toContain('Could not parse')
      expect(screen.getByText(text).tagName).toBe('PRE')
      unmount()
    }
  })

  it('renders open tasks before the collapsible completed group with stars, steps, and literal note text', () => {
    const note = '<img src=x onerror=alert(1)>'
    const text = JSON.stringify({ title: 'Sprint', tasks: [
      { id: 'open', title: 'Open task', completed: false, status: 'in-progress', important: true, steps: [{ title: 'Subtask', completed: true }], note },
      { id: 'done', title: 'Finished task', completed: true, status: 'done' },
    ] })
    const { container } = render(<TasksBody {...props(text)} />)
    const articles = [...container.querySelectorAll('article')]
    expect(articles.map(article => article.textContent?.includes('Open task'))).toEqual([true, false])
    expect(screen.getByText('★')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()
    expect(screen.getByText('Subtask')).toBeTruthy()
    const noteNode = screen.getByText(note)
    expect(noteNode.tagName).toBe('P')
    expect(container.querySelector('img')).toBeNull()
    const completed = screen.getByText('Completed').closest('details')
    expect(completed).not.toBeNull()
    expect(within(completed as HTMLElement).getByText('Finished task')).toBeTruthy()
    expect(screen.getByText('Open 1')).toBeTruthy()
    expect(screen.getByText('Done 1')).toBeTruthy()
  })

  it('writes a minimal id-targeted edit with the preview version and keeps unknown fields', async () => {
    const original = JSON.stringify({ title: 'Sprint', tasks: [{ id: 'a', title: 'Work', completed: false, status: 'todo', custom: { keep: true } }] })
    const write = vi.fn<TestWrite>(async () => ({ version: 'v2' }))
    render(<TasksBody {...props(original)} tasksRemote={{ write, read: vi.fn() }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    await waitFor(() => { expect(write).toHaveBeenCalledTimes(1) })
    const call = write.mock.calls[0]
    if (call === undefined) throw new Error('task write was not called')
    const [sessionId, path, serialized, version] = call
    expect(sessionId).toBe('s1')
    expect(path).toBe('/workspace/list.tasks')
    expect(version).toBe('v1')
    const parsed: unknown = JSON.parse(serialized)
    if (typeof parsed !== 'object' || parsed === null || !('tasks' in parsed) || !Array.isArray(parsed.tasks)) {
      throw new Error('serialized task document has no task array')
    }
    const writtenTask: unknown = parsed.tasks[0]
    if (typeof writtenTask !== 'object' || writtenTask === null || Array.isArray(writtenTask)) {
      throw new Error('serialized task is missing')
    }
    expect(writtenTask).toMatchObject({ id: 'a', status: 'done', completed: true, custom: { keep: true } })
    expect('completedAt' in writtenTask && typeof writtenTask.completedAt === 'string').toBe(true)
    expect(serialized).toContain('\n  "tasks": [')
  })

  it('re-reads and retries one stale edit against fresh content once', async () => {
    const original = JSON.stringify({ tasks: [{ id: 'a', title: 'Work', completed: false, status: 'todo', other: 1 }] })
    const fresh = JSON.stringify({ tasks: [{ id: 'a', title: 'Work', completed: false, status: 'todo', other: 2 }] })
    const write = vi.fn<TestWrite>()
      .mockRejectedValueOnce({ code: 'gaia-tasks/stale' })
      .mockResolvedValueOnce({ version: 'v3' })
    const read = vi.fn(async () => ({ text: fresh, version: 'v2' }))
    render(<TasksBody {...props(original)} tasksRemote={{ write, read }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    await waitFor(() => { expect(write).toHaveBeenCalledTimes(2) })
    expect(read).toHaveBeenCalledTimes(1)
    expect((JSON.parse(write.mock.calls[1]?.[2] as string) as { tasks: Array<Record<string, unknown>> }).tasks[0]).toMatchObject({ id: 'a', other: 2, status: 'done' })
    expect(write.mock.calls[1]?.[3]).toBe('v2')
  })
})
