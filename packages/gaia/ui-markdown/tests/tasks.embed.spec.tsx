// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { TasksBody } from '../src/client/TasksBody.tsx'
import type { TasksBodyProps } from '../src/client/TasksBody.tsx'
import type { MarkdownKey } from '../src/client/locales.ts'

const labels: Record<MarkdownKey, string> = {
  label: 'Obsidian', copy: 'Copy', copied: 'Copied', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: 'Read aloud', stopSection: 'Stop reading',
  tasksLabel: 'Tasks', openTasks: 'Open', tasksRemaining: 'tasks remaining', taskRemaining: 'task remaining', tasksFileIncomplete: 'Not fully loaded', completedTasks: 'Completed', untitledTask: 'Untitled task',
  invalidTasksFile: 'Could not parse this tasks file. Showing the raw text.', stepsLabel: 'steps',
  statusTodo: 'To Do', statusDone: 'Done', statusToDebate: 'To Debate', statusToPlan: 'To Plan', statusToImplement: 'To Implement', statusInProgress: 'In Progress', statusToReview: 'To Review', statusOnHold: 'On Hold', statusCanceled: 'Canceled',
  completeTask: 'Mark complete', reopenTask: 'Reopen task', toggleImportant: 'Toggle important', important: 'Important', changeStatus: 'Change status', toggleStep: 'Toggle step', editTitle: 'Edit task title', addTask: 'Add task', deleteTask: 'Delete task', saveFailed: 'Could not save', staleInvalidFile: 'Stale invalid',
}

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent')

function props(path: string): TasksBodyProps {
  return {
    content: { kind: 'text', text: '{"tasks":[]}', pages: [], eof: true },
    resourceAddress: 'dsh-resource://file/session/s1/workspace/list.tasks',
    useResource: () => ({ status: 'ready', value: { absolutePath: path, version: 'v1' } }),
    t: (key: MarkdownKey) => labels[key],
  } as unknown as TasksBodyProps
}

function setParentFrame(): void {
  Object.defineProperty(window, 'parent', { configurable: true, value: {} })
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-gaia-full')
  document.documentElement.removeAttribute('data-gaia-embed')
  if (originalParent) Object.defineProperty(window, 'parent', originalParent)
})

describe('Gaia Tasks viewer embed', () => {
  it('uses the origin-root Gaia viewer URL for an absolute .tasks path in a Gaia frame', () => {
    setParentFrame()
    document.documentElement.setAttribute('data-gaia-embed', '')
    render(<TasksBody {...props('/workspace/Team & notes/list.tasks')} />)

    const frame = screen.getByTitle('list.tasks') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe(`${window.location.origin}/embed/tasks?path=%2Fworkspace%2FTeam%20%26%20notes%2Flist.tasks`)
    expect(frame.hasAttribute('sandbox')).toBe(false)
    expect(frame.className).toBeTruthy()
  })

  it('keeps the existing task renderer when the Gaia attribute is absent', () => {
    setParentFrame()
    render(<TasksBody {...props('/workspace/list.tasks')} />)
    expect(screen.getByRole('heading', { name: 'list' })).toBeTruthy()
    expect(screen.queryByTitle('list.tasks')).toBeNull()
  })

  it.each(['/workspace/list', 'workspace/list.tasks', '/workspace/../list.tasks', '/workspace/./list.tasks'])(
    'falls back for an invalid absolute task path: %s', (path) => {
      setParentFrame()
      document.documentElement.setAttribute('data-gaia-full', '')
      render(<TasksBody {...props(path)} />)
      expect(screen.getByRole('heading', { name: 'list' })).toBeTruthy()
      expect(screen.queryByTitle('list.tasks')).toBeNull()
    },
  )

  it('switches to the iframe when the Gaia root attribute is added after mount', async () => {
    setParentFrame()
    render(<TasksBody {...props('/workspace/list.tasks')} />)
    expect(screen.getByRole('heading', { name: 'list' })).toBeTruthy()

    document.documentElement.setAttribute('data-gaia-full', '')
    await waitFor(() => { expect(screen.getByTitle('list.tasks')).toBeTruthy() })
    expect(screen.queryByRole('heading', { name: 'list' })).toBeNull()
  })
})
