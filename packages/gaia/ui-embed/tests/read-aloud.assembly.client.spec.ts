// @vitest-environment jsdom
import { expect, vi } from 'vitest'
import { act, fireEvent, within } from '@testing-library/react'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import * as gaiaEmbed from '../src/client/index.ts'

const name = '@deepseek-ai/dsh-gaia-ui-embed'
const roster = ClientRoster.of([...webApp.rows, { name, inject: [], immediately: false }])
const test = createClientTest({ roster, provide: { [name]: gaiaEmbed } })
const mountedTest = createClientTest({ roster, provide: { [name]: gaiaEmbed } }, { mount: true })

mountedTest('validated parent playback decorates the speaking row in the loaded sidebar', async ({ start, remote }) => {
  const originalParent = window.parent
  const originalUrl = window.location.href
  const parent = document.createElement('iframe')
  document.body.append(parent)
  Object.defineProperty(window, 'parent', { value: parent.contentWindow, configurable: true })
  window.history.replaceState(null, '', '/?gaia=full')
  remote.session.list.mockResolvedValue({ ok: true, value: { items: ['s1', 's2'].map(id => ({
    sessionId: SessionId(id), agentAvailable: false, updatedAt: 0, running: false, blank: false,
  })) } })
  try {
    const client = await start()
    await client.flush()
    const ui = within(client.container!)
    expect(client.ctx.sessions.list.getSnapshot().ids).toEqual(['s1', 's2'])
    fireEvent.click(ui.getByRole('treeitem', { name: 'Ungrouped' }))
    await client.flush()
    const playback = { source: 'gaia-dsh', v: 1, type: 'readAloudState', enabled: true,
      status: 'speaking', sessionId: 's1', messageId: 'm1' }
    const send = async (data: object, source = parent.contentWindow) => {
      act(() => { window.dispatchEvent(new MessageEvent('message', { data, source, origin: window.location.origin })) })
      await client.flush()
    }
    await send(playback, window)
    expect(ui.queryByRole('img', { name: 'Reading aloud' })).toBeNull()
    await send(playback)
    expect(ui.getByRole('img', { name: 'Reading aloud' }).closest('[role="treeitem"]')?.textContent).toContain('s1')
    await send({ ...playback, status: 'paused', sessionId: 's2' })
    const indicator = ui.getByRole('img', { name: 'Reading aloud' })
    expect(indicator.closest('[role="treeitem"]')?.textContent).toContain('s2')
    expect(indicator.hasAttribute('data-playing')).toBe(false)
    await send({ ...playback, status: 'idle', sessionId: null, messageId: null })
    expect(ui.queryByRole('img', { name: 'Reading aloud' })).toBeNull()
  } finally {
    Object.defineProperty(window, 'parent', { value: originalParent, configurable: true })
    window.history.replaceState(null, '', originalUrl)
    parent.remove()
  }
}, 30_000)

test('Loader composition contributes narration in Gaia full mode and removes it on reload/unload', async ({ start }) => {
  const originalParent = window.parent
  const originalUrl = window.location.href
  const parent = document.createElement('iframe')
  document.body.append(parent)
  Object.defineProperty(window, 'parent', { value: parent.contentWindow, configurable: true })
  window.history.replaceState(null, '', '/?gaia=full')
  try {
    const client = await start()
    await client.flush()
    const entries = () => client.ctx.slots.entries('conversation.chat.assistant-actions').filter(entry => entry.options.id === 'gaia-read-aloud')
    const decoration = () => client.ctx.slots.entries('sidebar.session.row.decoration').filter(entry => entry.options.id === 'gaia-read-aloud')
    const automatic = () => client.ctx.slots.entries('conversation.input.overlay').filter(entry => entry.options.id === 'gaia-auto-read')
    expect(entries()).toHaveLength(1)
    expect(automatic()).toHaveLength(1)
    expect(decoration()).toHaveLength(1)
    await client.reload(name)
    expect(entries()).toHaveLength(1)
    expect(automatic()).toHaveLength(1)
    expect(decoration()).toHaveLength(1)
    await client.unload(name)
    expect(entries()).toHaveLength(0)
    expect(automatic()).toHaveLength(0)
    expect(decoration()).toHaveLength(0)
  } finally {
    Object.defineProperty(window, 'parent', { value: originalParent, configurable: true })
    window.history.replaceState(null, '', originalUrl)
    parent.remove()
  }
}, 30_000)

for (const mode of ['embed', 'full']) {
  test('Loader routes reviews only in agent embeds and disposes interception: ' + mode, async ({ start }) => {
    const originalParent = window.parent
    const originalUrl = window.location.href
    const parent = document.createElement('iframe')
    document.body.append(parent)
    Object.defineProperty(window, 'parent', { value: parent.contentWindow, configurable: true })
    const post = vi.spyOn(parent.contentWindow!, 'postMessage')
    window.history.replaceState(null, '', '/?gaia=' + mode + '&session=s-review')
    try {
      const client = await start()
      await client.flush()
      const address = 'dsh-resource://changes-review/session/s-review/32/2'
      post.mockClear()
      if (mode === 'embed') {
        const reviewParams = { index: 1, line: 1 }
        client.ctx.sidebarRight.openResource(address, { params: reviewParams })
        expect(post).toHaveBeenCalledWith({ source: 'gaia-dsh', v: 1, type: 'openChangesReview', sessionId: 's-review', seq: 32, turn: 2, index: 1 }, window.location.origin)
        await client.reload(name)
        post.mockClear()
        client.ctx.sidebarRight.openResource(address)
        expect(post).toHaveBeenCalledTimes(1)
        await client.unload(name)
        post.mockClear()
      }
      // No session is adopted by this fixture; native placement throws, not a bridge request.
      expect(() => { client.ctx.sidebarRight.openResource(address) }).toThrow()
      expect(post).not.toHaveBeenCalled()
    } finally {
      post.mockRestore()
      Object.defineProperty(window, 'parent', { value: originalParent, configurable: true })
      window.history.replaceState(null, '', originalUrl)
      parent.remove()
    }
  }, 30_000)
}
