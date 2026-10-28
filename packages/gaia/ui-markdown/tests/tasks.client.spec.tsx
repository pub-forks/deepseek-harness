// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { tasksDefinition, TASKS_BODY_ID } from '../src/client/markdown-definition.ts'
import { parseTasksText, TasksBody } from '../src/client/TasksBody.tsx'
import type { TasksBodyProps } from '../src/client/TasksBody.tsx'
import type { MarkdownKey } from '../src/client/locales.ts'

afterEach(cleanup)

const labels: Record<MarkdownKey, string> = {
  label: 'Obsidian', copy: 'Copy', copied: 'Copied', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes', readSection: 'Read aloud', stopSection: 'Stop reading',
  tasksLabel: 'Tasks', openTasks: 'Open', doneTasks: 'Done', completedTasks: 'Completed', untitledTask: 'Untitled task',
  invalidTasksFile: 'Could not parse this tasks file. Showing the raw text.', stepsLabel: 'steps',
  statusToDebate: 'To Debate', statusToPlan: 'To Plan', statusToImplement: 'To Implement', statusInProgress: 'In Progress', statusToReview: 'To Review', statusOnHold: 'On Hold', statusCanceled: 'Canceled',
}

function props(text: string, path = '/workspace/list.tasks') {
  return {
    content: { kind: 'text' as const, text, pages: [], eof: true },
    resourceAddress: 'dsh-resource://file/session/s1/workspace/list.tasks',
    useResource: () => ({ status: 'ready', value: { absolutePath: path } }),
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
})
