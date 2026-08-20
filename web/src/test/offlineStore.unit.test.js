import { beforeEach, describe, expect, it } from "vitest";
import {
  createClientRequestId,
  readOfflineLeaveQueue,
  readWorkspaceCache,
  writeOfflineLeaveQueue,
  writeWorkspaceCache,
} from "../lib/offlineStore";

describe("offlineStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps workspace caches isolated by authenticated user", () => {
    writeWorkspaceCache("user-a", { organization: { id: "org-a" }, entries: [] });
    writeWorkspaceCache("user-b", { organization: { id: "org-b" }, entries: [] });

    expect(readWorkspaceCache("user-a").workspace.organization.id).toBe("org-a");
    expect(readWorkspaceCache("user-b").workspace.organization.id).toBe("org-b");
  });

  it("persists queued leave payloads and supports a stable request id", () => {
    const clientRequestId = createClientRequestId();
    writeOfflineLeaveQueue("user-a", [{
      localId: "offline-1",
      payload: {
        leave_type: "Annual leave",
        start_date: "2026-08-20",
        end_date: "2026-08-21",
        note: "Family event",
        client_request_id: clientRequestId,
      },
    }]);

    const queue = readOfflineLeaveQueue("user-a");
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.client_request_id).toBe(clientRequestId);
    expect(readOfflineLeaveQueue("user-b")).toEqual([]);
  });
});
