import { useContext } from "react";
import { NotificationContext } from "./NotificationContext.jsx";

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationsProvider");
  return context;
}
