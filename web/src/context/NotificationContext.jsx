import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAttendance } from "./AttendanceContext";

export const NotificationContext = createContext(null);
import { requestJson } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
const MAX_NOTIFICATIONS = 40;
const RECONNECT_DELAYS = [1000, 2500, 5000, 10000, 30000];

function configuredApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || "";
}

function configuredWebsocketUrl() {
  const explicitUrl = import.meta.env.VITE_NOTIFICATION_WS_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const apiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const path = import.meta.env.VITE_NOTIFICATION_WS_PATH?.trim() || "/v1/notifications/ws";
  if (!apiUrl) return "";
  return `${apiUrl.replace(/^http/i, "ws")}${path.startsWith("/") ? path : `/${path}`}`;
}

function withConnectionCredentials(baseUrl, userId, token) {
  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("user_id", userId);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export function NotificationsProvider({ children }) {
  const { dataSource, applyRealtimeAttendance, applyExceptionUpdate } = useAttendance();
  const authToken = useAuthStore((state) => state.token);
  const authUserId = useAuthStore((state) => state.user?.id);
  const [notifications, setNotifications] = useState([]);
  const [connectionState, setConnectionState] = useState("disabled");
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  const closeSocket = useCallback(() => {
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    reconnectTimerRef.current = null;
    heartbeatRef.current = null;
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    const userId = authUserId;
    const apiBaseUrl = configuredApiBaseUrl();
    const baseUrl = configuredWebsocketUrl();
    if (!userId || dataSource !== "database" || !authToken || !baseUrl || !apiBaseUrl || typeof WebSocket === "undefined") {
      closeSocket();
      setConnectionState("disabled");
      return undefined;
    }

    let disposed = false;

    const connect = async () => {
      if (disposed) return;
      setConnectionState(reconnectAttemptRef.current ? "reconnecting" : "connecting");

      let websocketToken;
      try {
        const payload = await requestJson(
          `${apiBaseUrl.replace(/\/$/, "")}/v1/notifications/token`,
          { headers: { Authorization: `Bearer ${authToken}` } },
          "Realtime notifications are unavailable.",
        );
        websocketToken = payload?.token;
      } catch {
        if (!disposed) setConnectionState("disabled");
        return;
      }
      if (disposed || !websocketToken) {
        if (!disposed) setConnectionState("disabled");
        return;
      }

      const socket = new WebSocket(withConnectionCredentials(baseUrl, userId, websocketToken));
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionState("connected");
        heartbeatRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "connection.ready") return;
          if (payload.type === "attendance.verified") applyRealtimeAttendance(payload);
          if (payload.type === "attendance.exception") applyExceptionUpdate(payload);
          setNotifications((current) => [
            { ...payload, id: `${payload.timestamp || Date.now()}-${Math.random()}`, read: false },
            ...current,
          ].slice(0, MAX_NOTIFICATIONS));
        } catch {
          // Ignore malformed events; the websocket remains usable.
        }
      };

      socket.onerror = () => setConnectionState("error");
      socket.onclose = () => {
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        socketRef.current = null;
        if (disposed) return;
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttemptRef.current += 1;
        setConnectionState("reconnecting");
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    setNotifications([]);
    connect();
    return () => {
      disposed = true;
      closeSocket();
      setConnectionState("disabled");
    };
  }, [applyExceptionUpdate, applyRealtimeAttendance, authToken, authUserId, closeSocket, dataSource]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    connectionState,
    isRealtimeEnabled: connectionState !== "disabled",
    markAllRead,
    clearNotifications,
  }), [clearNotifications, connectionState, markAllRead, notifications, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

