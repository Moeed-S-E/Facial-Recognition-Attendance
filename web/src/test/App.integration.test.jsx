import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { useAuthStore } from '../store/useAuthStore.js'

const directoryPayload = {
  organization: {
    id: 'org-northstar',
    name: 'Northstar Labs',
    users_count: 4,
    account_owner_id: 'user-owner',
    account_owner_name: 'Avery Morgan',
    account_owner_email: 'owner@northstarlabs.com',
  },
  teams: [
    { id: 'team-engineering', name: 'Engineering', manager_name: 'Jordan Bell' },
  ],
  accounts: [
    { id: 'user-owner', name: 'Avery Morgan', email: 'owner@northstarlabs.com', role: 'super_admin', team_id: null, account_status: 'active', recognition_status: 'enrolled' },
    { id: 'user-hr', name: 'Priya Shah', email: 'hr@northstarlabs.com', role: 'hr', team_id: null, account_status: 'active', recognition_status: 'enrolled' },
    { id: 'user-manager', name: 'Jordan Bell', email: 'manager@northstarlabs.com', role: 'manager', team_id: 'team-engineering', account_status: 'active', recognition_status: 'enrolled' },
    { id: 'user-employee', name: 'Noah Williams', email: 'employee@northstarlabs.com', role: 'employee', team_id: 'team-engineering', account_status: 'active', recognition_status: 'enrolled' },
  ],
  attendance: [],
}

function renderWorkspace(initialRole = 'enterprise_admin') {
  window.history.pushState({}, '', '/demo')
  return render(<App initialRole={initialRole} />)
}

describe('organization workspace integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    useAuthStore.setState({ token: null, user: null })
    globalThis.fetch = vi.fn((url) => Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(url.includes('/team-requests') ? [] : directoryPayload),
    }))
    window.localStorage.clear()
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    window.localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('loads the organization directory and scopes owner navigation', async () => {
    renderWorkspace()

    expect(await screen.findByText('Northstar Labs · Global')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Subscription' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in to workspace' })).toBeInTheDocument()
    expect(screen.queryByText('Preview identity')).not.toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8000/v1/demo/directory', undefined)
    expect(screen.getByText(/Demo workspace:/)).toBeInTheDocument()
    expect(screen.getByText(/seeded sample data/)).toBeInTheDocument()
  })

  it('dismisses the owner action menu when the user clicks outside it', async () => {
    useAuthStore.setState({
      token: 'owner-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    window.history.pushState({}, '', '/app/team')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Organization directory' })).toBeInTheDocument()
    const manageButton = await screen.findByRole('button', { name: 'Manage Priya Shah' })
    fireEvent.click(manageButton)
    expect(await screen.findByRole('menu')).toHaveTextContent('Change role')

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('routes an unenrolled organization owner to face enrollment before attendance', async () => {
    const unenrolledOwnerPayload = {
      ...directoryPayload,
      accounts: directoryPayload.accounts.map((account) => account.id === 'user-owner' ? { ...account, recognition_status: 'not_enrolled' } : account),
    }
    useAuthStore.setState({
      token: 'owner-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    globalThis.fetch = vi.fn((url) => Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(url.includes('/team-requests') ? [] : unenrolledOwnerPayload),
    }))
    window.history.pushState({}, '', '/app')
    render(<App />)

    const enrollButton = await screen.findByRole('button', { name: 'Enroll attendance photo' })
    fireEvent.click(enrollButton)
    expect(await screen.findByText('Attendance enrollment')).toBeInTheDocument()
    expect(window.location.search).toBe('?mode=enroll')
  })

  it('routes an owner with an open check-in to check-out', async () => {
    const checkedInOwnerPayload = {
      ...directoryPayload,
      attendance: [{ id: 'attendance-today', user_id: 'user-owner', check_in: new Date(Date.now() - 60 * 60 * 1000).toISOString(), check_out: null, status: 'Present' }],
    }
    useAuthStore.setState({
      token: 'owner-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    globalThis.fetch = vi.fn((url) => Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(url.includes('/team-requests') ? [] : checkedInOwnerPayload),
    }))
    window.history.pushState({}, '', '/app')
    render(<App />)

    const checkOutButton = await screen.findByRole('button', { name: 'Check out' })
    fireEvent.click(checkOutButton)
    expect(await screen.findByText('Departure verification')).toBeInTheDocument()
    expect(window.location.search).toBe('?mode=check-out')
  })

  it('lets an organization owner retake their enrollment photo from Profile', async () => {
    useAuthStore.setState({
      token: 'owner-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    window.history.pushState({}, '', '/app/profile')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retake enrollment photo' }))
    expect(await screen.findByText('Attendance enrollment')).toBeInTheDocument()
    expect(window.location.search).toBe('?mode=enroll')
  })

  it('redirects a direct check-in route to enrollment for an unenrolled user', async () => {
    const unenrolledOwnerPayload = {
      ...directoryPayload,
      accounts: directoryPayload.accounts.map((account) => account.id === 'user-owner' ? { ...account, recognition_status: 'not_enrolled' } : account),
    }
    useAuthStore.setState({
      token: 'owner-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    globalThis.fetch = vi.fn((url) => Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(url.includes('/team-requests') ? [] : unenrolledOwnerPayload),
    }))
    window.history.pushState({}, '', '/verify?mode=check-in')
    render(<App />)

    expect(await screen.findByText('Attendance enrollment')).toBeInTheDocument()
    expect(window.location.search).toBe('?mode=enroll')
  })

  it('does not let public demo data open the live attendance camera', async () => {
    renderWorkspace()

    const openAttendance = await screen.findByRole('button', { name: 'Record my attendance' })
    fireEvent.click(openAttendance)

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('keeps sign out disabled only for the public demo workspace', async () => {
    window.history.pushState({}, '', '/demo/profile')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Sign out is disabled in the public demo only.')
    expect(window.location.pathname).toBe('/demo/profile')
  })

  it('clears authenticated state and redirects live users to login on sign out', async () => {
    useAuthStore.setState({
      token: 'live-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    window.history.pushState({}, '', '/app/profile')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('falls back to the public landing page for the retired /admin route', async () => {
    window.history.pushState({}, '', '/admin')
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('Platform owner console')).not.toBeInTheDocument()
  })

  it('redirects guests away from the protected workspace route', async () => {
    window.history.pushState({}, '', '/app')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('redirects guests before the live verification camera can open', async () => {
    window.history.pushState({}, '', '/verify?mode=check-in')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('shows only employee self-service navigation for an employee account', async () => {
    renderWorkspace('employee')

    expect(await screen.findByRole('link', { name: 'My attendance' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leave' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'People' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Insights' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Subscription' })).not.toBeInTheDocument()
  })

  it('exposes manager navigation without organization subscription controls', async () => {
    renderWorkspace('manager')

    expect(await screen.findByRole('link', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leave' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Subscription' })).not.toBeInTheDocument()
  })
})
