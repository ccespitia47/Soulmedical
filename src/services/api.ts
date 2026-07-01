const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api`;

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
      const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return { data: null, error: 'Sesión expirada' };
      }
      const body = await response.json().catch(() => ({}));
      return { data: null, error: body.message || 'Credenciales incorrectas' };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { data: null, error: body.message || `Error ${response.status}` };
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
  return request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export type AuthMessageResponse = { success: boolean; message: string };

export async function register(name: string, email: string, password: string): Promise<ApiResponse<AuthMessageResponse>> {
  return request<AuthMessageResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
}

export async function forgotPassword(email: string): Promise<ApiResponse<AuthMessageResponse>> {
  return request<AuthMessageResponse>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string): Promise<ApiResponse<AuthMessageResponse>> {
  return request<AuthMessageResponse>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
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
  try { return JSON.parse(raw); } catch { return null; }
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// --- Usuarios ---

export type UserApiData = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'coordinator' | 'user';
  isActive: boolean;
  createdAt: string;
};

export async function getUsersApi() {
  return request<UserApiData[]>('/users');
}

export async function createUserApi(dto: { name: string; email: string; password: string; role: string }) {
  return request<UserApiData>('/users', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateUserApi(id: number, dto: { name?: string; email?: string; role?: string; password?: string }) {
  return request<UserApiData>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export async function deleteUserApi(id: number) {
  return request<void>(`/users/${id}`, { method: 'DELETE' });
}

export async function toggleUserActiveApi(id: number) {
  return request<UserApiData>(`/users/${id}/toggle`, { method: 'PATCH' });
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
  return request<ProjectData>('/projects', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateProjectApi(id: string, dto: { name?: string; color?: string; icon?: string }) {
  return request<ProjectData>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export async function deleteProjectApi(id: string) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' });
}

export async function getProjectAssignmentsApi(projectId: string) {
  return request<{ projectId: string; userId: number }[]>(`/projects/${projectId}/assignments`);
}

export async function assignProjectToUserApi(projectId: string, userId: number) {
  return request<{ projectId: string; userId: number }>(`/projects/${projectId}/assign`, {
    method: 'POST', body: JSON.stringify({ userId }),
  });
}

export async function unassignProjectFromUserApi(projectId: string, userId: number) {
  return request<void>(`/projects/${projectId}/assign/${userId}`, { method: 'DELETE' });
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
  return request<FolderData>('/folders', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateFolderApi(id: string, dto: { name?: string; color?: string; icon?: string }) {
  return request<FolderData>(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
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
  return request<FormApiData>('/forms', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateFormApi(id: string, dto: { name?: string; schema?: object; emailTemplate?: object }) {
  return request<FormApiData>(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
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
    method: 'POST', body: JSON.stringify({ data, metadata }),
  });
}

export async function getFormAssignmentsApi(formId: string) {
  return request<{ formId: string; userId: number }[]>(`/forms/${formId}/assignments`);
}

export async function assignFormToUserApi(formId: string, userId: number) {
  return request<{ formId: string; userId: number }>(`/forms/${formId}/assign`, {
    method: 'POST', body: JSON.stringify({ userId }),
  });
}

export async function unassignFormFromUserApi(formId: string, userId: number) {
  return request<void>(`/forms/${formId}/assign/${userId}`, { method: 'DELETE' });
}

export async function getSubmissionsApi(formId: string, page = 1, limit = 50) {
  return request<SubmissionsPage>(`/forms/${formId}/submissions?page=${page}&limit=${limit}`);
}

// --- Grupos ---

export type GroupData = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  createdAt: string;
};

export async function getGroupsApi() {
  return request<GroupData[]>('/groups');
}

export async function createGroupApi(dto: { name: string; description?: string; color?: string; icon?: string }) {
  return request<GroupData>('/groups', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateGroupApi(id: string, dto: { name?: string; description?: string; color?: string; icon?: string }) {
  return request<GroupData>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export async function deleteGroupApi(id: string) {
  return request<void>(`/groups/${id}`, { method: 'DELETE' });
}

export async function getGroupMembersApi(groupId: string) {
  return request<{ groupId: string; userId: number }[]>(`/groups/${groupId}/members`);
}

export async function addGroupMemberApi(groupId: string, userId: number) {
  return request<{ groupId: string; userId: number }>(`/groups/${groupId}/members`, {
    method: 'POST', body: JSON.stringify({ userId }),
  });
}

export async function removeGroupMemberApi(groupId: string, userId: number) {
  return request<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
}

export async function getGroupAssignmentsApi(groupId: string) {
  return request<{ groupId: string; projectId: string | null; formId: string | null }[]>(`/groups/${groupId}/assignments`);
}

export async function assignProjectToGroupApi(groupId: string, projectId: string) {
  return request<void>(`/groups/${groupId}/assign/project`, {
    method: 'POST', body: JSON.stringify({ projectId }),
  });
}

export async function unassignProjectFromGroupApi(groupId: string, projectId: string) {
  return request<void>(`/groups/${groupId}/assign/project/${projectId}`, { method: 'DELETE' });
}

export async function assignFormToGroupApi(groupId: string, formId: string) {
  return request<void>(`/groups/${groupId}/assign/form`, {
    method: 'POST', body: JSON.stringify({ formId }),
  });
}

export async function unassignFormFromGroupApi(groupId: string, formId: string) {
  return request<void>(`/groups/${groupId}/assign/form/${formId}`, { method: 'DELETE' });
}