import axios from 'axios';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── Documents ────────────────────────────────────────────────────────────────

export const uploadDocument = (file: File, onProgress?: (pct: number) => void) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{ documentId: string; status: string }>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
};

export const getDocuments = () => api.get('/documents');
export const deleteDocument = (id: string) => api.delete(`/documents/${id}`);
export const getDocumentStatus = (id: string) =>
  api.get<{ id: string; status: string; errorMessage: string | null; totalChunks: number | null }>(
    `/documents/${id}/status`,
  );

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name?: string) =>
    api.post('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
};

// ── Chat ─────────────────────────────────────────────────────────────────────

export const createChatSession = (title?: string) =>
  api.post('/chat/sessions', { title });
export const getChatSessions = () => api.get('/chat/sessions');
export const getChatSession = (id: string) => api.get(`/chat/sessions/${id}`);
export const deleteChatSession = (id: string) => api.delete(`/chat/sessions/${id}`);

interface SourceRef {
  documentId: string;
  documentName: string;
  chunkIndex: number;
}

type SseEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; sources: SourceRef[] }
  | { type: 'error'; message: string };

export const sendMessage = async (
  sessionId: string,
  question: string,
  onChunk: (text: string) => void,
  onDone: (sources: SourceRef[]) => void,
  onError?: (msg: string) => void,
): Promise<void> => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const response = await fetch(
    `${BASE_URL}/chat/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const raw = decoder.decode(value, { stream: true });
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6)) as SseEvent;
        if (data.type === 'chunk') onChunk(data.text);
        if (data.type === 'done') onDone(data.sources ?? []);
        if (data.type === 'error') onError?.(data.message);
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const getAnalyticsCosts = () => api.get('/analytics/costs');
export const getAnalyticsUsage = () => api.get('/analytics/usage');

export default api;
