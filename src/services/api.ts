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
      // Endpoints de credenciales/flujo de auth: el 401 significa "datos
      // incorrectos" (password mala, código TOTP mal, token corto expirado,
      // etc.) y se debe MOSTRAR el mensaje al usuario, NO borrar la sesión
      // ni redirigir al root.
      //
      // Cualquier OTRO endpoint con 401 significa "tu sesión de app expiró"
      // y ahí sí limpiamos y mandamos al login.
      const isAuthFlowEndpoint =
        endpoint.startsWith('/auth/login') ||
        endpoint.startsWith('/auth/register') ||
        endpoint.startsWith('/auth/2fa/') ||
        endpoint.startsWith('/auth/forgot-password') ||
        endpoint.startsWith('/auth/reset-password');
      if (!isAuthFlowEndpoint) {
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
  /** Permisos efectivos (rol base + extras). El backend los devuelve en login/profile. */
  permissions?: string[];
};

/**
 * El backend devuelve uno de TRES objetos al hacer login:
 *  - { requires2FA: true, requiresSetup: true,  setupToken }   → usuario sin 2FA aún, debe configurarlo
 *  - { requires2FA: true, requiresSetup: false, pendingToken } → usuario con 2FA activo, debe meter el código
 *  - { access_token, user }                                    → login completado (sin 2FA en absoluto, no usado hoy)
 *
 * El frontend distingue con la propiedad `requires2FA`.
 */
export type LoginFinalResponse = {
  access_token: string;
  user: AuthUser;
  requires2FA?: undefined;
};

export type Login2FASetupResponse = {
  requires2FA: true;
  requiresSetup: true;
  setupToken: string;
};

export type Login2FAVerifyResponse = {
  requires2FA: true;
  requiresSetup: false;
  pendingToken: string;
};

export type LoginResponse =
  | LoginFinalResponse
  | Login2FASetupResponse
  | Login2FAVerifyResponse;

export async function login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
  return request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

// ── 2FA ───────────────────────────────────────────────────────────────────────

export type TwoFaSetupResponse = {
  qrDataUrl: string;
  secret: string;
};

/** Paso de setup: el backend devuelve el QR (data URL) y el secret base32. */
export async function start2FASetupApi(setupToken: string): Promise<ApiResponse<TwoFaSetupResponse>> {
  return request<TwoFaSetupResponse>('/auth/2fa/setup', {
    method: 'POST',
    body: JSON.stringify({ setupToken }),
  });
}

/** Confirma el primer código TOTP → activa 2FA → devuelve JWT final. */
export async function confirm2FASetupApi(setupToken: string, code: string): Promise<ApiResponse<LoginFinalResponse>> {
  return request<LoginFinalResponse>('/auth/2fa/confirm-setup', {
    method: 'POST',
    body: JSON.stringify({ setupToken, code }),
  });
}

/** Usuario con 2FA ya activo: valida el código y devuelve JWT final. */
export async function verifyLogin2FAApi(pendingToken: string, code: string): Promise<ApiResponse<LoginFinalResponse>> {
  return request<LoginFinalResponse>('/auth/2fa/verify-login', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, code }),
  });
}

/** Usuario logueado resetea su propio 2FA (perdió el dispositivo). Requiere su password. */
export async function reset2FAApi(password: string): Promise<ApiResponse<AuthMessageResponse>> {
  return request<AuthMessageResponse>('/auth/2fa/reset', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
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

/**
 * Limpia la sesión y FUERZA navegación a /login con `replace`. El uso de
 * `location.replace` (no `pushState`) elimina la entrada del historial, así
 * el botón "atrás" del navegador no puede volver al área autenticada
 * mostrando estado cacheado en memoria de React/Zustand.
 *
 * Pasar `redirect: false` cuando llamamos desde un sitio donde React Router
 * ya va a navegar (evita doble navegación).
 */
export function clearSession(opts: { redirect?: boolean } = { redirect: true }) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (opts.redirect && typeof window !== 'undefined') {
    // Si el usuario está dentro del namespace de Consientify, lo devolvemos a
    // su propio login (no al login general de Grupo Soul).
    const path = window.location.pathname;
    const target = path.startsWith('/consientify') ? '/consientify/login' : '/login';
    window.location.replace(target);
  }
}

// --- Usuarios ---

export type UserApiData = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'coordinator' | 'user';
  isActive: boolean;
  /** Permisos EXTRA otorgados (no incluye los de rol base). */
  permissions: string[];
  /** true si el usuario ya configuró su 2FA TOTP. */
  totpEnabled?: boolean;
  /** Numero de documento del usuario. Se usa como contraseña del ZIP de reportes. */
  documentNumber?: string | null;
  createdAt: string;
};

export async function getUsersApi() {
  return request<UserApiData[]>('/users');
}

export async function createUserApi(dto: {
  name: string;
  email: string;
  password: string;
  role: string;
  documentNumber?: string;
}) {
  return request<UserApiData>('/users', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateUserApi(
  id: number,
  dto: {
    name?: string;
    email?: string;
    role?: string;
    password?: string;
    documentNumber?: string;
  },
) {
  return request<UserApiData>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export async function deleteUserApi(id: number) {
  return request<void>(`/users/${id}`, { method: 'DELETE' });
}

export async function toggleUserActiveApi(id: number) {
  return request<UserApiData>(`/users/${id}/toggle`, { method: 'PATCH' });
}

/** Reemplaza los permisos extra del usuario (no toca los de rol base). */
export async function updateUserPermissionsApi(id: number, permissions: string[]) {
  return request<UserApiData>(`/users/${id}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

/** Admin: borra el TOTP del usuario para que vuelva a configurar 2FA al loguearse. */
export async function adminResetUser2faApi(id: number) {
  return request<AuthMessageResponse>(`/users/${id}/reset-2fa`, {
    method: 'POST',
  });
}

// ── Auditoría de acciones de admin ───────────────────────────────────────────

export type AdminAuditAction =
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_TOGGLE_ACTIVE'
  | 'USER_PERMISSIONS_CHANGE'
  | 'USER_RESET_2FA'
  | 'FORM_DELETE'
  | 'FORM_TOGGLE_PUBLIC'
  | 'REPORT_REQUESTED'
  | 'REPORT_DOWNLOADED'
  | 'REPORT_DOWNLOAD_FAILED';

export type AdminAuditTargetType = 'USER' | 'FORM' | 'PROJECT' | 'FOLDER';

export type AdminAuditEntry = {
  id: number;
  action: AdminAuditAction;
  actorId: number;
  actorName: string;
  actorRole: string;
  targetType: AdminAuditTargetType;
  targetId: string;
  targetName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminAuditPage = {
  data: AdminAuditEntry[];
  total: number;
  page: number;
  limit: number;
};

export type AdminAuditFilters = {
  actorId?: number;
  action?: AdminAuditAction;
  targetType?: AdminAuditTargetType;
  targetId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export async function getAdminAuditApi(filters: AdminAuditFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return request<AdminAuditPage>(`/admin/audit${qs ? '?' + qs : ''}`);
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
  schema: { widgets: unknown[]; rules?: unknown[] };
  emailTemplate: unknown | null;
  isPublic?: boolean;
  sendConfirmationEmail?: boolean;
  requiresEmailVerification?: boolean;
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

// --- Mis envíos (submissions del usuario logueado) ---

export type MySubmissionItem = {
  id: string;
  formId: string;
  formVersion: number;
  submittedById: number | null;
  data: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  submittedAt: string;
};

export type MySubmissionsPage = {
  data: MySubmissionItem[];
  total: number;
  page: number;
  limit: number;
};

export async function getMySubmissionsApi(page = 1, limit = 50) {
  return request<MySubmissionsPage>(`/submissions/mine/list?page=${page}&limit=${limit}`);
}

// --- Tareas del usuario logueado ---

export type MyTaskItem = {
  taskId: string;
  title: string;
  description?: string;
  formName: string;
  myStepOrder: number;
  totalSteps: number;
  currentStepOrder: number;
  myStatus: 'in_progress' | 'pending' | 'waiting';
  token: string;
  waitingForName?: string;
  waitingForEmail?: string;
  createdAt: string;
};

export async function getMyTasksApi() {
  return request<MyTaskItem[]>('/tasks/my-tasks');
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

/**
 * Solicita el reporte de envíos del formulario. NO descarga el archivo:
 * el backend lo cifra en un ZIP AES-256 (password = numero de documento
 * del usuario logueado) y lo envía por correo. Devuelve un mensaje.
 */
export async function requestReportByEmailApi(formId: string, fieldIds: string[]) {
  return request<{ success: boolean; message: string; recipients: number }>(
    `/forms/${formId}/submissions/export-email`,
    { method: 'POST', body: JSON.stringify({ fieldIds }) },
  );
}

export type ReportDownloadMeta = {
  formName: string;
  expiresAt: string; // ISO date
};

export async function getReportDownloadMetaApi(token: string) {
  return request<ReportDownloadMeta>(`/reports/download/${token}/meta`);
}

/**
 * POST al endpoint de descarga. El backend responde con el `.xlsx` cifrado
 * como blob binario. NO usamos la función `request<T>` común porque no
 * devuelve JSON. Aquí manejamos fetch manual para poder capturar el blob.
 */
export async function downloadReportApi(
  token: string,
  code: string,
): Promise<{ data: { blob: Blob; filename: string } | null; error: string | null }> {
  const jwt = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  try {
    const res = await fetch(`${API_URL}/reports/download/${token}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.message || `Error ${res.status}` };
    }

    const blob = await res.blob();
    // Extraer filename del Content-Disposition (RFC 5987 con encodeURIComponent).
    const disp = res.headers.get('Content-Disposition') ?? '';
    const match = disp.match(/filename="([^"]+)"/);
    const filename = match ? decodeURIComponent(match[1]) : 'reporte.xlsx';
    return { data: { blob, filename }, error: null };
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor' };
  }
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


export async function submitFormApi(
  formId: string,
  data: Record<string, unknown>,
  apiKey?: string,
  templateSnapshot?: string,
  pdfFilename?: string,
): Promise<ApiResponse<SubmissionData>> {
  const body: Record<string, unknown> = { data };
  if (templateSnapshot) body.templateSnapshot = templateSnapshot;
  if (pdfFilename) body.pdfFilename = pdfFilename;
  return request<SubmissionData>(`/forms/${formId}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: apiKey ? { "X-API-Key": apiKey } : undefined,
  });
}
