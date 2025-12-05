// src/api/auth.js

const BASE_URL = "http://127.0.0.1:8000"; // Django backend

// -----------------------------
// Token helpers
// -----------------------------
const TOKEN_KEY = "upi_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function logout() {
  setAuthToken(null);
}

// -----------------------------
// Generic JSON POST helper
// -----------------------------
async function postJson(path, payload, { auth = false } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error
  }

  if (!res.ok) {
    const detail =
      data?.detail ||
      data?.error ||
      `HTTP ${res.status} ${res.statusText || ""}`.trim();
    throw new Error(detail);
  }

  return data;
}

// -----------------------------
// Auth API
// -----------------------------

/**
 * Login with Django backend.
 * Expects Django to return: { token: "...", user: {...} }
 */
export async function login(email, password) {
  const data = await postJson("/api/login/", { email, password });

  if (!data?.token) {
    throw new Error("Login response did not include a token");
  }

  setAuthToken(data.token);
  return data;
}

/**
 * Register with Django backend.
 * Expects Django to return: { token: "...", user: {...} }
 */
export async function register(email, password) {
  const data = await postJson("/api/register/", { email, password });

  if (!data?.token) {
    throw new Error("Register response did not include a token");
  }

  setAuthToken(data.token);
  return data;
}
