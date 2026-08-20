import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Leave from "../screens/Leave.jsx";

const { submitLeave, updateLeavePolicy, reviewManagerLeave, mockState } = vi.hoisted(() => ({
  submitLeave: vi.fn(),
  updateLeavePolicy: vi.fn(),
  reviewManagerLeave: vi.fn(),
  mockState: {
    activeRole: "employee",
    managerLeaveRequests: [],
  },
}));

vi.mock("../context/AttendanceContext", () => ({
  useAttendance: () => ({
    isLoading: false,
    leaveRequests: [],
    managerLeaveRequests: mockState.managerLeaveRequests,
    submitLeave,
    reviewManagerLeave,
    activeRole: mockState.activeRole,
    leavePolicy: { annualDays: 12, medicalDays: 8 },
    updateLeavePolicy,
    isOnline: true,
    offlineQueueCount: 0,
  }),
}));

const pendingRequest = {
  id: "leave-1",
  employee: "Test Employee",
  type: "Annual leave",
  dates: "Aug 20 – Aug 21",
  submitted: "Aug 19",
  status: "Pending",
  note: "Family travel",
};

describe("Leave request form and approvals", () => {
  beforeEach(() => {
    mockState.activeRole = "employee";
    mockState.managerLeaveRequests = [];
    vi.clearAllMocks();
  });

  it.each(["enterprise_admin", "hr", "manager"])("shows leave approvals to the %s role", (role) => {
    mockState.activeRole = role;
    mockState.managerLeaveRequests = [pendingRequest];

    render(<Leave />);

    expect(screen.getByText("Leave approvals")).toBeInTheDocument();
    expect(screen.getByText("Test Employee")).toBeInTheDocument();
  });

  it("does not show leave approvals to an employee", () => {
    mockState.managerLeaveRequests = [pendingRequest];

    render(<Leave />);

    expect(screen.queryByText("Leave approvals")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("approves a pending request", async () => {
    mockState.activeRole = "hr";
    mockState.managerLeaveRequests = [pendingRequest];
    reviewManagerLeave.mockResolvedValueOnce({ ok: true, request: {} });
    render(<Leave />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(reviewManagerLeave).toHaveBeenCalledWith("leave-1", "Approved"));
  });

  it("rejects a pending request", async () => {
    mockState.activeRole = "manager";
    mockState.managerLeaveRequests = [pendingRequest];
    reviewManagerLeave.mockResolvedValueOnce({ ok: true, request: {} });
    render(<Leave />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(reviewManagerLeave).toHaveBeenCalledWith("leave-1", "Declined"));
  });

  it("submits the request when the Submit request button is clicked", async () => {
    submitLeave.mockResolvedValueOnce({ ok: true, queued: false, request: {} });
    render(<Leave />);

    fireEvent.click(screen.getByRole("button", { name: "Request leave" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-08-20" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-08-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(submitLeave).toHaveBeenCalledWith({
      type: "Annual leave",
      startDate: "2026-08-20",
      endDate: "2026-08-21",
      note: "",
    }));
    expect(await screen.findByText("Leave request submitted.")).toBeInTheDocument();
  });
});
