import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { useAuthStore } from '../store/useAuthStore'

class MockWebSocket {
  static OPEN = 1
  static instances = []

  constructor(url) {
    this.url = url
    this.readyState = 0
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    MockWebSocket.instances.push(this)
  }

  send() {}

  close() {
    this.readyState = 3
    this.onclose?.()
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  message(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

const jsonResponse = (payload) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(payload),
})

const directoryPayload = {
  organization: {
    id: 'org-northstar',
    name: 'Northstar Labs',
    users_count: 4,
    account_owner_id: 'user-owner',
    account_owner_name: 'Avery Morgan',
    account_owner_email: 'owner@northstarlabs.com',
  },
  teams: [],
  accounts: [
    { id: 'user-owner', name: 'Avery Morgan', email: 'owner@northstarlabs.com', role: 'super_admin', team_id: null, account_status: 'active', recognition_status: 'enrolled' },
  ],
  attendance: [],
}

describe('realtime notification integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubEnv('VITE_NOTIFICATION_WS_URL', 'ws://localhost:8000/v1/notifications/ws')
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/v1/notifications/token')) {
        return Promise.resolve(jsonResponse({ token: 'signed-ws-token', expires_in: 300 }))
      }
      return Promise.resolve(jsonResponse(directoryPayload))
    })
    globalThis.WebSocket = MockWebSocket
    window.WebSocket = MockWebSocket
    window.history.pushState({}, '', '/demo')
    window.localStorage.clear()
    MockWebSocket.instances = []
    useAuthStore.setState({ token: null, user: null })
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    vi.unstubAllEnvs()
  })

  it('does not attempt a rejected socket connection from the public demo workspace', async () => {
    render(<App initialRole="enterprise_admin" />)

    await waitFor(() => expect(screen.getByText('Demo workspace:')).toBeInTheDocument())
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('connects authenticated users with a short-lived subject token and renders pushed events', async () => {
    useAuthStore.setState({
      token: 'signed-access-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'enterprise_admin', name: 'Avery Morgan' },
    })
    window.history.pushState({}, '', '/app')
    render(<App initialRole="enterprise_admin" />)

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    const socket = MockWebSocket.instances[0]
    expect(socket.url).toContain('user_id=user-owner')
    expect(socket.url).toContain('token=signed-ws-token')

    act(() => socket.open())

    act(() => socket.message({
      type: 'attendance.evidence.accepted',
      title: 'Attendance capture accepted',
      message: 'Your latest attendance evidence is ready.',
      timestamp: '2026-08-17T10:00:00.000Z',
    }))

    expect(screen.getByRole('button', { name: 'Open notifications' })).toHaveTextContent('1')
    act(() => screen.getByRole('button', { name: 'Open notifications' }).click())
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent('Attendance capture accepted')
    expect(screen.getByText('1 unread update')).toBeInTheDocument()

    act(() => screen.getByRole('button', { name: 'Close notifications' }).click())
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument()
  })
})
