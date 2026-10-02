// @vitest-environment jsdom
import { expect, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import type { SessionInputShell } from '../../../client/ui-conversation/src/client/input/facade.ts'
import { plainTurn } from '../../../api/session-controller/tests/event-script.client.ts'
import { followScript, history } from '../../../api/session-controller/tests/remote/session.client.ts'
import * as gaiaEmbed from '../src/client/index.ts'

const name = '@deepseek-ai/dsh-gaia-ui-embed'
const roster = ClientRoster.of([...webApp.rows, { name, inject: [], immediately: false }])
const test = createClientTest({ roster, provide: { [name]: gaiaEmbed } }, { mount: true })

for (const mode of ['embed', 'full']) {
  test('Loader-mounted history restores drafts and disposes/reloads in ' + mode, async ({ start, remote, mock }) => {
    let removeViews: (() => Promise<void>) | undefined
    const originalBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { value: () => new DOMRect(), configurable: true })
    const originalParent = window.parent
    const originalUrl = window.location.href
    const parent = document.createElement('iframe')
    document.body.append(parent)
    Object.defineProperty(window, 'parent', { value: parent.contentWindow, configurable: true })
    window.history.replaceState(null, '', '/?gaia=' + mode + '&session=s-history')
    const sid = SessionId('s-history')
    const events = [
      ...plainTurn(SessionSeq(0), 0, 'older question', 'older answer'),
      ...plainTurn(SessionSeq(6), 1, 'newer\nquestion', 'newer answer'),
    ]
    remote.session.list.mockResolvedValue({ ok: true, value: { items: [{
      sessionId: sid, agentAvailable: true, updatedAt: 0, running: false, blank: false,
    }] } })
    remote.commands.list.mockResolvedValue({ ok: true, value: [] })
    remote.skills.list.mockResolvedValue({ ok: true, value: { skills: [] } })
    mock.stream('session/follow', followScript(history(events)))
    mock.stream('job/list', (_args, stream) => { stream.push({ type: 'rows', jobs: [] }) })
    try {
      const client = await start()
      removeViews = async () => {
        await client.unload('@deepseek-ai/dsh-client-ui-renderer')
        await client.flush()
      }
      act(() => { client.ctx.uiWorkspace.openSession(sid) })
      await client.flush()
      await vi.waitFor(() => {
        expect(client.ctx.sessions.binding(sid)?.session.getSnapshot().openState).toBe('open')
        expect(client.container!.querySelector('[data-composer-input]')).not.toBeNull()
      })
      const binding = client.ctx.sessions.binding(sid)!
      const input = client.ctx.conversation.input.for(binding.ctx) as SessionInputShell
      const composer = () => client.container!.querySelector<HTMLDivElement>('[data-composer-input]')!
      const rows = () => [...composer().querySelectorAll('p')].map(row => row.textContent)
      const outputs: (string | null)[][] = []
      act(() => { input.setDraft('  unsent\n\ndraft  ') })
      await client.flush()
      act(() => {
        composer().focus()
        window.getSelection()!.collapse(composer().firstElementChild!.firstChild!, 0)
        fireEvent(document, new Event('selectionchange'))
      })
      await client.flush()
      const original = input.editor.getEditorState().toJSON()
      const originalWindow = binding.eventSource.getSnapshot().entries
      expect(composer().getAttribute('contenteditable')).toBe('true')
      const arrow = async (key: 'ArrowUp' | 'ArrowDown') => {
        act(() => { fireEvent.keyDown(composer(), { key }) })
        await client.flush()
        outputs.push(rows())
      }
      await arrow('ArrowUp')
      expect(input.snapshot.draft).toBe('newer\nquestion')
      await arrow('ArrowUp')
      expect(input.snapshot.draft).toBe('older question')
      await arrow('ArrowDown')
      expect(input.snapshot.draft).toBe('newer\nquestion')
      await arrow('ArrowDown')
      expect(input.snapshot.draft).toBe('  unsent\n\ndraft  ')
      expect(input.editor.getEditorState().toJSON()).toEqual(original)
      expect(outputs).toMatchInlineSnapshot(`
        [
          [
            "newer",
            "question",
          ],
          [
            "older question",
          ],
          [
            "newer",
            "question",
          ],
          [
            "  unsent",
            "",
            "draft  ",
          ],
        ]
      `)
      await arrow('ArrowUp')
      expect(input.snapshot.draft).toBe('newer\nquestion')
      await client.reload(name)
      await client.flush()
      await arrow('ArrowDown')
      expect(input.snapshot.draft).toBe('  unsent\n\ndraft  ')
      await arrow('ArrowUp')
      expect(input.snapshot.draft).toBe('newer\nquestion')
      await arrow('ArrowDown')
      await client.unload(name)
      await client.flush()
      await arrow('ArrowUp')
      expect(input.snapshot.draft).toBe('  unsent\n\ndraft  ')
      expect(binding.eventSource.getSnapshot().entries).toEqual(originalWindow)
      expect(remote.session.prompt).not.toHaveBeenCalled()
    } finally {
      // Remove live views before fixture-wide service disposal, including failed assertions.
      await removeViews?.()
      if (originalBounds) Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalBounds)
      else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
      Object.defineProperty(window, 'parent', { value: originalParent, configurable: true })
      window.history.replaceState(null, '', originalUrl)
      parent.remove()
    }
  }, 60_000)
}
