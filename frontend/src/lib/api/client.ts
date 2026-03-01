export type ApiEnvelope<T> = {
  message: string;
  data: T;
};

type ErrorEnvelope = {
  message?: string;
  status?: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const errorBody = (await response.json()) as ErrorEnvelope;
      if (errorBody.message) {
        message = errorBody.message;
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
