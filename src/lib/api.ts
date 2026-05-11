const rawApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_ENGAGEMENT_API_URL || "/api";

export const API_BASE_URL = String(rawApiUrl).replace(/\/$/, "");

export async function callApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "Content-Type": "application/json"
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API ${path} failed with ${response.status}: ${details}`);
  }

  return (await response.json()) as T;
}
