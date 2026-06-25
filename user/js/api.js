import { PUBLIC_AUTH_TOKEN_KEY } from "./constants.js";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(PUBLIC_AUTH_TOKEN_KEY);
  const headers = { "Content-Type": "application/json" };
  if (token && path.startsWith("/public/")) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response
    .json()
    .catch(() => ({ success: false, message: "Invalid server response" }));

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return payload;
}
