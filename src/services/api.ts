const API_URL = 'http://localhost:3001/api';

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expirado o inválido → limpiar sesión y redirigir al login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
      return { data: null, error: 'Sesión expirada' };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        data: null,
        error: body.message || `Error ${response.status}`,
      };
    }

    if (response.status === 204) return { data: null, error: null };

    const data = await response.json();
    return { data, error: null };
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor' };
  }
}

// --- Auth ---

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'coordinator' | 'user';
};

type LoginResponse = {
  access_token: string;
  user: AuthUser;
};

export async function login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  name: string,
  email: string,
  password: string,
  role?: string,
): Promise<ApiResponse<LoginResponse>> {
  return request<LoginResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  });
}

export async function getProfile(): Promise<ApiResponse<AuthUser>> {
  return request<AuthUser>('/auth/profile');
}

// --- Helpers de sesión ---

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// --- Proyectos ---

export type ProjectData = {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
};

export async function getProjects() {
  return request<ProjectData[]>('/projects');
}

export async function createProject(dto: { name: string; color: string; icon: string }) {
  return request<ProjectData>('/projects', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateProjectApi(id: string, dto: { name?: string; color?: string; icon?: string }) {
  return request<ProjectData>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteProjectApi(id: string) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' });
}

// --- Carpetas ---

export type FolderData = {
  id: string;
  name: string;
  color: string;
  icon: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export async function getFoldersByProject(projectId: string) {
  return request<FolderData[]>(`/folders?projectId=${projectId}`);
}

export async function createFolder(dto: { name: string; color: string; icon: string; projectId: string }) {
  return request<FolderData>('/folders', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateFolderApi(id: string, dto: { name?: string; color?: string; icon?: string }) {
  return request<FolderData>(`/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteFolderApi(id: string) {
  return request<void>(`/folders/${id}`, { method: 'DELETE' });
}

// --- Formularios ---

export type FormApiData = {
  id: string;
  name: string;
  folderId: string;
  schema: { widgets: unknown[] };
  emailTemplate: unknown | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export async function getFormsByFolder(folderId: string) {
  return request<FormApiData[]>(`/forms?folderId=${folderId}`);
}

export async function createFormApi(dto: { name: string; folderId: string; schema?: object; emailTemplate?: object }) {
  return request<FormApiData>('/forms', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateFormApi(id: string, dto: { name?: string; schema?: object; emailTemplate?: object }) {
  return request<FormApiData>(`/forms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteFormApi(id: string) {
  return request<void>(`/forms/${id}`, { method: 'DELETE' });
}

// --- Respuestas de formularios ---

export type SubmissionData = {
  id: string;
  formId: string;
  formVersion: number;
  data: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  submittedAt: string;
};

export type SubmissionsPage = {
  data: SubmissionData[];
  total: number;
  page: number;
  limit: number;
};

export async function submitFormApi(
  formId: string,
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>,
) {
  return request<SubmissionData>(`/forms/${formId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ data, metadata }),
  });
}

export async function getSubmissionsApi(formId: string, page = 1, limit = 50) {
  return request<SubmissionsPage>(`/forms/${formId}/submissions?page=${page}&limit=${limit}`);
}
