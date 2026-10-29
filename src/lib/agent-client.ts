// Browser-side helpers for the reception agent running on the same PC.

const KEY = "tf.agentUrl";
export const DEFAULT_AGENT_URL = "http://127.0.0.1:7171";

export function getAgentUrl(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_AGENT_URL;
  } catch {
    return DEFAULT_AGENT_URL;
  }
}

export function setAgentUrl(url: string) {
  try {
    if (url && url !== DEFAULT_AGENT_URL) localStorage.setItem(KEY, url);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: fall back to the default each time.
  }
}

export async function agentFetch(path: string, init?: RequestInit, timeoutMs = 1500): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(getAgentUrl() + path, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}
