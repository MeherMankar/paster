"use client";

import type { EncryptionMeta, PublicPaste } from "./paste";

export type ApiPaste = PublicPaste & { url: string; rawUrl: string };
export type CreatedPaste = ApiPaste & { editToken: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `request failed (${res.status})`);
  }
  return data as T;
}

export type CreateBody = {
  content: string;
  title?: string;
  lang?: string;
  expires?: string;
  burn?: boolean;
  enc?: EncryptionMeta;
};

export const api = {
  create: (body: CreateBody) => call<CreatedPaste>("/api/v1/pastes", { method: "POST", body: JSON.stringify(body) }),
  read: (id: string) => call<ApiPaste>(`/api/v1/pastes/${encodeURIComponent(id)}`),
  update: (id: string, token: string, body: Partial<CreateBody>) =>
    call<PublicPaste>(`/api/v1/pastes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${token}` },
    }),
  delete: (id: string, token: string) =>
    call<void>(`/api/v1/pastes/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  report: (id: string, reason: string) =>
    call<{ ok: true; count: number; message: string }>(`/api/v1/pastes/${encodeURIComponent(id)}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
