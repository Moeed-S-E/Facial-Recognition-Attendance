import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttendanceProvider } from '../context/AttendanceProvider.jsx'
import { useAttendance } from '../context/AttendanceContext.jsx'
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
    { id: 'user-employee', name: 'Noah Williams', email: 'employee@northstarlabs.com', role: 'employee', team_id: null, account_status: 'active', recognition_status: 'enrolled' },
  ],
  attendance: [],
  attendance_policy: { start_time: '10:30', start_minutes: 630, timezone: 'Asia/Karachi' },
  leave_policy: { annual_days: 18, medical_days: 10 },
}

const createdAccount = {
  id: 'user-new',
  name: 'New Person',
  email: 'new@example.com',
  role: 'employee',
  team_id: null,
  account_status: 'active',
  recognition_status: 'not_enrolled',
}

const teamRequest = {
  id: 'request-1',
  employee_id: 'user-employee',
  employee_name: 'Noah Williams',
  team_id: 'team-engineering',
  team_name: 'Engineering',
  status: 'pending',
}

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(payload),
  }
}

function AttendanceStateHarness() {
  const { entries } = useAttendance()
  return (
    <div>
      <output data-testid="entry-status">{entries[0]?.status}</output>
      <output data-testid="entry-duration">{entries[0]?.duration}</output>
    </div>
  )
}

function AttendanceActionHarness() {
  const { day, recordAttendance, todayComplete } = useAttendance()
  const [result, setResult] = useState('')

  return (
    <div>
      <output data-testid="today-state">{todayComplete ? 'complete' : 'open'}</output>
      <output data-testid="check-in-state">{day.checkInAt ? 'checked-in' : 'not-checked-in'}</output>
      <output data-testid="check-out-state">{day.checkOutAt ? 'checked-out' : 'not-checked-out'}</output>
      <button onClick={() => setResult(recordAttendance('check-in').error || 'allowed')}>retry attendance</button>
      <output data-testid="attendance-result">{result}</output>
    </div>
  )
}

function AttendancePolicyHarness() {
  const { attendancePolicy, updateAttendancePolicy } = useAttendance()
  const [result, setResult] = useState('')

  return (
    <div>
      <output data-testid="policy-time">{attendancePolicy.startTime}</output>
      <button onClick={async () => setResult((await updateAttendancePolicy('11:00')).ok ? 'saved' : 'failed')}>save schedule</button>
      <output data-testid="policy-result">{result}</output>
    </div>
  )
}

function LeavePolicyHarness() {
  const { leavePolicy, updateLeavePolicy } = useAttendance()
  const [result, setResult] = useState('')

  return (
    <div>
      <output data-testid="annual-days">{leavePolicy.annualDays}</output>
      <output data-testid="medical-days">{leavePolicy.medicalDays}</output>
      <button onClick={async () => setResult((await updateLeavePolicy(20, 12)).ok ? 'saved' : 'failed')}>save leave policy</button>
      <output data-testid="leave-policy-result">{result}</output>
    </div>
  )
}

function MutationHarness() {
  const { isLoading, setActiveRole, createEmployeeAccount, assignEmployeeToTeam } = useAttendance()
  const [result, setResult] = useState('')

  const run = async (operation) => {
    const response = await operation()
    setResult(response.error || response.user?.email || response.teamId || '')
  }

  return (
    <div>
      <button onClick={() => run(() => createEmployeeAccount({ name: 'New Person', email: 'new@example.com' }))}>create as owner</button>
      <button onClick={() => setActiveRole('hr')}>switch to hr</button>
      <button onClick={() => run(() => createEmployeeAccount({ name: 'New Person', email: 'new@example.com' }))}>create as hr</button>
      <button onClick={() => setActiveRole('manager')}>switch to manager</button>
      <button onClick={() => run(() => assignEmployeeToTeam('user-employee', 'team-people'))}>request assignment</button>
      <output data-testid="ready">{isLoading ? 'loading' : 'ready'}</output>
      <output data-testid="result">{result}</output>
    </div>
  )
}

describe('AttendanceProvider permission mutations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-owner', email: 'owner@northstarlabs.com', role: 'super_admin', name: 'Avery Morgan' },
    })
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/v1/organization/directory')) return jsonResponse(directoryPayload)
      if (url.endsWith('/v1/organization/attendance-policy') && options.method === 'PUT') return jsonResponse({ start_time: '11:00', start_minutes: 660, timezone: 'Asia/Karachi' })
      if (url.endsWith('/v1/organization/leave-policy') && options.method === 'PUT') return jsonResponse({ annual_days: 20, medical_days: 12 })
      if (url.endsWith('/v1/organization/team-requests') && options.method === 'POST') return jsonResponse(teamRequest)
      if (url.endsWith('/v1/organization/team-requests')) return jsonResponse([])
      if (url.endsWith('/v1/organization/accounts') && options.method === 'POST') return jsonResponse(createdAccount)
      return jsonResponse({ detail: 'Unexpected test request' }, false, 500)
    })
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    vi.unstubAllEnvs()
  })

  it('loads and updates the organization attendance policy for management roles', async () => {
    render(
      <AttendanceProvider>
        <AttendancePolicyHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('policy-time')).toHaveTextContent('10:30'))
    fireEvent.click(screen.getByRole('button', { name: 'save schedule' }))
    await waitFor(() => expect(screen.getByTestId('policy-result')).toHaveTextContent('saved'))
    expect(screen.getByTestId('policy-time')).toHaveTextContent('11:00')
    const request = globalThis.fetch.mock.calls.find(([url, options]) => url.endsWith('/v1/organization/attendance-policy') && options?.method === 'PUT')
    expect(request).toBeDefined()
    expect(JSON.parse(request[1].body)).toEqual({ start_time: '11:00' })
  })

  it('loads and updates organization leave allowances for management roles', async () => {
    render(
      <AttendanceProvider>
        <LeavePolicyHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('annual-days')).toHaveTextContent('18'))
    expect(screen.getByTestId('medical-days')).toHaveTextContent('10')
    fireEvent.click(screen.getByRole('button', { name: 'save leave policy' }))
    await waitFor(() => expect(screen.getByTestId('leave-policy-result')).toHaveTextContent('saved'))
    expect(screen.getByTestId('annual-days')).toHaveTextContent('20')
    expect(screen.getByTestId('medical-days')).toHaveTextContent('12')
    const request = globalThis.fetch.mock.calls.find(([url, options]) => url.endsWith('/v1/organization/leave-policy') && options?.method === 'PUT')
    expect(request).toBeDefined()
    expect(JSON.parse(request[1].body)).toEqual({ annual_days: 20, medical_days: 12 })
  })

  it('rejects a second local attendance action after today is complete', async () => {
    const now = new Date()
    const completedPayload = {
      ...directoryPayload,
      attendance: [{ id: 'attendance-today', user_id: 'user-owner', check_in: new Date(now.getTime() - 3600000).toISOString(), check_out: now.toISOString(), status: 'Present' }],
    }
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith('/v1/organization/directory')) return jsonResponse(completedPayload)
      if (url.endsWith('/v1/organization/team-requests')) return jsonResponse([])
      return jsonResponse({ detail: 'Unexpected test request' }, false, 500)
    })

    render(
      <AttendanceProvider>
        <AttendanceActionHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('complete'))
    fireEvent.click(screen.getByRole('button', { name: 'retry attendance' }))
    expect(screen.getByTestId('attendance-result')).toHaveTextContent('Attendance is already recorded for today.')
  })

  it('uses the newest same-day open record so checkout remains available', async () => {
    const now = new Date()
    const olderCheckIn = new Date(now.getTime() - 7200000)
    const olderCheckOut = new Date(now.getTime() - 3600000)
    const newerOpenCheckIn = new Date(now.getTime() - 1800000)
    const duplicateDayPayload = {
      ...directoryPayload,
      attendance: [
        { id: 'attendance-open', user_id: 'user-owner', check_in: newerOpenCheckIn.toISOString(), check_out: null, status: 'Present' },
        { id: 'attendance-complete', user_id: 'user-owner', check_in: olderCheckIn.toISOString(), check_out: olderCheckOut.toISOString(), status: 'Present' },
      ],
    }
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith('/v1/organization/directory')) return jsonResponse(duplicateDayPayload)
      if (url.endsWith('/v1/organization/team-requests')) return jsonResponse([])
      return jsonResponse({ detail: 'Unexpected test request' }, false, 500)
    })

    render(
      <AttendanceProvider>
        <AttendanceActionHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('check-in-state')).toHaveTextContent('checked-in'))
    expect(screen.getByTestId('check-out-state')).toHaveTextContent('not-checked-out')
    expect(screen.getByTestId('today-state')).toHaveTextContent('open')
  })

  it('uses the server-owned open self-attendance record for checkout state', async () => {
    const now = new Date()
    const serverOwnedPayload = {
      ...directoryPayload,
      attendance: [],
      self_attendance: {
        id: 'attendance-open',
        user_id: 'user-owner',
        check_in: new Date(now.getTime() - 1800000).toISOString(),
        check_out: null,
        status: 'Present',
      },
    }
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith('/v1/organization/directory')) return jsonResponse(serverOwnedPayload)
      if (url.endsWith('/v1/organization/team-requests')) return jsonResponse([])
      return jsonResponse({ detail: 'Unexpected test request' }, false, 500)
    })

    render(
      <AttendanceProvider>
        <AttendanceActionHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('check-in-state')).toHaveTextContent('checked-in'))
    expect(screen.getByTestId('check-out-state')).toHaveTextContent('not-checked-out')
    expect(screen.getByTestId('today-state')).toHaveTextContent('open')
  })

  it('uses an older open self-attendance record for checkout recovery', async () => {
    const previousDay = new Date()
    previousDay.setDate(previousDay.getDate() - 1)
    const openRecordPayload = {
      ...directoryPayload,
      attendance: [],
      open_attendance: {
        id: 'attendance-old-open',
        user_id: 'user-owner',
        check_in: previousDay.toISOString(),
        check_out: null,
        status: 'Present',
      },
    }
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith('/v1/organization/directory')) return jsonResponse(openRecordPayload)
      if (url.endsWith('/v1/organization/team-requests')) return jsonResponse([])
      return jsonResponse({ detail: 'Unexpected test request' }, false, 500)
    })

    render(
      <AttendanceProvider>
        <AttendanceActionHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('check-in-state')).toHaveTextContent('checked-in'))
    expect(screen.getByTestId('check-out-state')).toHaveTextContent('not-checked-out')
    expect(screen.getByTestId('today-state')).toHaveTextContent('open')
  })

  it('allows the organization owner and HR to create accounts through the async API', async () => {
    render(
      <AttendanceProvider>
        <MutationHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'))

    fireEvent.click(screen.getByRole('button', { name: 'create as owner' }))
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('new@example.com'))

    fireEvent.click(screen.getByRole('button', { name: 'switch to hr' }))
    fireEvent.click(screen.getByRole('button', { name: 'create as hr' }))
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('new@example.com'))

    const accountRequests = globalThis.fetch.mock.calls.filter(([url, options]) => url.endsWith('/v1/organization/accounts') && options?.method === 'POST')
    expect(accountRequests).toHaveLength(2)
    expect(JSON.parse(accountRequests[0][1].body)).toMatchObject({ name: 'New Person', email: 'new@example.com', role: 'employee' })
  })

  it('makes managers submit a request for their own team instead of directly assigning employees', async () => {
    useAuthStore.setState({
      token: 'manager-token',
      user: { id: 'user-manager', email: 'manager@northstarlabs.com', role: 'manager', name: 'Jordan Bell' },
    })
    render(
      <AttendanceProvider>
        <MutationHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'))
    fireEvent.click(screen.getByRole('button', { name: 'request assignment' }))

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('team-engineering'))
    const request = globalThis.fetch.mock.calls.find(([url, options]) => url.endsWith('/v1/organization/team-requests') && options?.method === 'POST')
    expect(request).toBeDefined()
    expect(JSON.parse(request[1].body)).toMatchObject({ employee_query: 'employee@northstarlabs.com', team_id: 'team-engineering' })
  })

  it('does not fetch restricted team requests before the persisted role has hydrated', async () => {
    useAuthStore.setState({ token: 'hydrating-token', user: null })
    render(
      <AttendanceProvider>
        <MutationHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'))
    const teamRequestReads = globalThis.fetch.mock.calls.filter(([url, options]) => url.endsWith('/v1/organization/team-requests') && !options?.method)
    expect(teamRequestReads).toHaveLength(0)
  })

  it('labels an unfinished previous-day record as missing checkout', async () => {
    useAuthStore.setState({
      token: 'employee-token',
      user: { id: 'user-employee', email: 'employee@northstarlabs.com', role: 'employee', name: 'Noah Williams' },
    })
    const previousDay = new Date()
    previousDay.setDate(previousDay.getDate() - 1)
    const previousDayPayload = {
      ...directoryPayload,
      attendance: [{ id: 'attendance-old', user_id: 'user-employee', check_in: previousDay.toISOString(), check_out: null, status: 'Present' }],
    }
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith('/v1/organization/directory')) return jsonResponse(previousDayPayload)
      if (url.endsWith('/v1/organization/leave-requests')) return jsonResponse([])
      return jsonResponse({ detail: 'Unexpected test request' }, false, 500)
    })

    render(
      <AttendanceProvider>
        <AttendanceStateHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('entry-status')).toHaveTextContent('Missing checkout'))
    expect(screen.getByTestId('entry-duration')).toHaveTextContent('Missing checkout')
  })

  it('does not fetch restricted team requests for an Employee during first render', async () => {
    useAuthStore.setState({
      token: 'employee-token',
      user: { id: 'user-employee', email: 'employee@northstarlabs.com', role: 'employee', name: 'Noah Williams' },
    })
    render(
      <AttendanceProvider>
        <MutationHarness />
      </AttendanceProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'))
    const teamRequestReads = globalThis.fetch.mock.calls.filter(([url, options]) => url.endsWith('/v1/organization/team-requests') && !options?.method)
    expect(teamRequestReads).toHaveLength(0)
  })
})
