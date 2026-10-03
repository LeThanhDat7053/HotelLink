/**
 * Gọi các endpoint GHI của trang /vr360-scene-sync trên hosting khách sạn
 * (vr360-views.php, share-og.php, share-image.php). Mọi request kèm mật khẩu
 * VR360_EDITOR_PASSWORD qua header X-VR360-Editor-Key.
 */

export class EditorApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface EditorResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

const send = async (url: string, editorKey: string, init: RequestInit): Promise<EditorResponse> => {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), 'X-VR360-Editor-Key': editorKey },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as EditorResponse | null;

  if (!response.ok || !payload?.ok) {
    throw new EditorApiError(
      payload?.message || `Yêu cầu thất bại (HTTP ${response.status})`,
      payload?.error || 'request_failed',
      response.status,
    );
  }
  return payload;
};

export const editorApi = {
  postJson: (url: string, editorKey: string, body: Record<string, unknown>) =>
    send(url, editorKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  postForm: (url: string, editorKey: string, form: FormData) => send(url, editorKey, { method: 'POST', body: form }),
};

/** Đọc file JSON tĩnh trên hosting; 404 hoặc app shell HTML (file chưa có) → null */
export const fetchStaticJson = async (url: string): Promise<unknown | null | undefined> => {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  const isJson = (response.headers.get('content-type') || '').includes('json');
  if (response.status === 404 || (response.ok && !isJson)) return null;
  if (!response.ok) return undefined; // lỗi hosting → giữ bản đang có
  return response.json();
};
