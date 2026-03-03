export type ApiEnvelope<T> = {
  message: string;
  data: T;
};
import { useAuthStore } from "@/stores/authStore";

type ErrorEnvelope = {
  message?: string;
  status?: number;
  code?: string;
};

function toBaseUrl(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\/$/, "");
}

function buildRequestUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;

  const envBase = toBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
  if (envBase && path.startsWith("/")) {
    return `${envBase}${path}`;
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "5173") {
    if (path.startsWith("/api")) {
      return `http://localhost:8080${path}`;
    }
  }

  return path;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildRequestUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      const { isAuthenticated, markSessionExpired } = useAuthStore.getState();
      if (isAuthenticated) {
        markSessionExpired();
      }
    }

    let message = `API request failed: ${response.status}`;
    try {
      const errorBody = (await response.json()) as ErrorEnvelope | Record<string, string>;
      if ("message" in errorBody && typeof errorBody.message === "string" && errorBody.message) {
        const code = "code" in errorBody && typeof errorBody.code === "string" ? errorBody.code : null;
        message = code ? `[${code}] ${errorBody.message}` : errorBody.message;
      } else if (errorBody && typeof errorBody === "object") {
        const fieldMessage = Object.entries(errorBody)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        if (fieldMessage) {
          message = fieldMessage;
        }
      }
    } catch {
      // Ignore parse failure and fallback to status text.
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  return body.data;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { method: "GET", ...init });
}

export function apiPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  init?: RequestInit,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
}

export function apiPatch<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  init?: RequestInit,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
}
