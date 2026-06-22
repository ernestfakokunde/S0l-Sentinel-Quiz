import { API_URL } from "./config";

export type ApiError = {
  error?: string;
  message?: string;
};

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly userMessage: string;

  constructor(status: number, userMessage = "Something went wrong. Please try again.") {
    super(userMessage);
    this.name = "ApiRequestError";
    this.status = status;
    this.userMessage = userMessage;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiRequestError(0, "Connection issue. Please try again shortly.");
  }

  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new ApiRequestError(response.status, payload.message || payload.error || "Request could not be completed.");
  }
  return payload;
}
