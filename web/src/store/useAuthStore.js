import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_BASE_URL } from "../constants";
import { requestJson } from "../lib/api";

function apiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error("The API URL is not configured. Set VITE_API_BASE_URL in web/.env.local.");
  }
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

const AUTH_STORAGE_KEY = "auth-storage";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      login: async (email, password) => {
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const data = await requestJson(apiUrl("/token"), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }, "Login failed.");
        const token = data.access_token;
        
        let user = null;
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          user = { 
            id: payload.id,
            email: payload.email || payload.sub,
            role: payload.role || payload.scopes?.[0], 
            name: payload.name,
            onboarded: payload.onboarded
          };
        } catch (err) {
          console.error("Invalid token format");
        }

        set({ token, user });
        return true;
      },

      register: async (organizationName, name, email, password) => {
        await requestJson(apiUrl("/register"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ organization_name: organizationName, name, email, password }),
        }, "Registration failed.");

        // Auto-login after successful registration
        await get().login(email, password);
        return true;
      },

      logout: () => {
        set({ token: null, user: null });
      },

      updateToken: (token) => {
        let user = null;
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          user = { 
            id: payload.id,
            email: payload.email || payload.sub,
            role: payload.role || payload.scopes?.[0], 
            name: payload.name,
            onboarded: payload.onboarded
          };
        } catch (err) {
          console.error("Invalid token format");
        }
        set({ token, user });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
    }
  )
);

// Zustand persist writes the new session to localStorage, but it does not
// automatically hydrate other open tabs. Rehydrate on storage changes so one
// browser has one active organization account and logout closes every tab.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== AUTH_STORAGE_KEY) return;
    useAuthStore.persist.rehydrate().catch(() => {
      useAuthStore.setState({ token: null, user: null });
    });
  });
}
