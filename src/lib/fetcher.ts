async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // corpo não-JSON
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function fetcher<T = unknown>(url: string): Promise<T> {
  return fetch(url).then((r) => handle<T>(r));
}

export function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => handle<T>(r));
}

export function apiPatch<T = unknown>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => handle<T>(r));
}

export function apiDelete<T = unknown>(url: string): Promise<T> {
  return fetch(url, { method: "DELETE" }).then((r) => handle<T>(r));
}
