import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { API_BASE_URL } from "../constants";

export default function AuthenticatedAvatar({ src, name = "", className = "", fallbackClassName = "", headers }) {
  const token = useAuthStore((state) => state.token);
  const [objectUrl, setObjectUrl] = useState("");
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SA";

  useEffect(() => {
    let active = true;
    let createdUrl = "";
    if (!src || (!token && !headers)) {
      setObjectUrl("");
      return () => {};
    }
    fetch(`${API_BASE_URL}${src}`, { headers: headers || { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!active || !blob) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setObjectUrl("");
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, token, headers]);

  if (!objectUrl) return <div className={fallbackClassName || className}>{initials}</div>;
  return <img src={objectUrl} alt={`${name} profile`} className={className} />;
}
