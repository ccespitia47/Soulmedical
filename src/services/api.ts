const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api`;

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

type RequestOptions = RequestInit & {
  /** false: un 401 NO borra la sesión ni redirige al login; se devuelve como error normal.
   *  Solo para consultas de fondo que no deben tirar un formulario con trabajo sin guardar. */
  redirectOn401?: boolean;
};

async function request<T>(
  endpoint: string,
  { redirectOn401 = true, ...options }: RequestOptions = {},
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
      if (!isAuthFlowEndpoint && !redirectOn401) {
        return { data: null, error: 'Sesión expirada' };
      }
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

    // Algunos endpoints devuelven 200 con body VACÍO (ej. DELETE /api-keys/:id
    // cuyo service retorna Promise<void> — Nest no lo convierte a 204). Si
    // intentamos response.json() con body vacío, lanza "Unexpected end of JSON
    // input" y el catch convierte eso en un error confuso tipo "No se pudo
    // conectar con el servidor". Chequeamos Content-Length / Content-Type para
    // detectar esos casos y resolver con data=null limpio.
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type') || '';
    if (contentLength === '0' || !contentType.includes('application/json')) {
      return { data: null, error: null };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      data: null,
      error: `No se pudo conectar con el servidor: ${detail} (${endpoint})`,
    };
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

export async function register(
  name: string,
  email: string,
  password: string,
  documentNumber?: string,
): Promise<ApiResponse<AuthMessageResponse>> {
  const body: Record<string, string> = { name, email, password };
  const doc = documentNumber?.trim();
  if (doc) body.documentNumber = doc;
  return request<AuthMessageResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

/**
 * Renueva el JWT del usuario logueado. El backend requiere el token actual
 * válido y devuelve uno nuevo con TTL fresco. Se llama desde useIdleLogout
 * mientras hay actividad, para evitar que la sesión caiga por el TTL
 * absoluto del JWT (30 min desde emisión).
 */
export async function refreshTokenApi(): Promise<ApiResponse<LoginFinalResponse>> {
  // redirectOn401:false es CRÍTICO: si el refresh llega tarde (pestaña en
  // segundo plano, equipo suspendido) el token ya expiró y este POST responde
  // 401. Con el manejo por defecto, ese 401 borraba la sesión y mandaba al
  // login en mitad del trabajo. Devolviéndolo como error normal, useIdleLogout
  // reintenta en vez de cerrar la sesión.
  return request<LoginFinalResponse>('/auth/refresh', { method: 'POST', redirectOn401: false });
}

/**
 * Auto-edición del perfil del usuario logueado. El backend acepta SOLO
 * nombre, email, documentNumber y (opcional) password nueva. Rol, permisos
 * y 2FA son manejados exclusivamente por admin desde /users/:id.
 */
export function updateMyProfileApi(body: {
  name?: string;
  email?: string;
  password?: string;
  documentNumber?: string;
}) {
  return request<UserApiData>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
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
  | 'FORM_EDIT'
  | 'FORM_DELETE'
  | 'FORM_TOGGLE_PUBLIC'
  | 'REPORT_REQUESTED'
  | 'REPORT_DOWNLOADED'
  | 'REPORT_DOWNLOAD_FAILED'
  | 'SUBMISSION_PDF_VIEWED'
  | 'SUBMISSION_PDF_DOWNLOADED'
  | 'SUBMISSION_DELETE'
  | 'SUBMISSIONS_BULK_PDF_REQUESTED'
  | 'SUBMISSIONS_BULK_PDF_DOWNLOADED'
  | 'SUBMISSIONS_BULK_PDF_FAILED'
  | 'EXCEL_HEADERS_ACCESSED'
  | 'EXCEL_SEARCH_PERFORMED';

export type AdminAuditTargetType =
  | 'USER'
  | 'FORM'
  | 'PROJECT'
  | 'FOLDER'
  | 'SUBMISSION'
  | 'EXCEL_FILE';

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

/** Resumen liviano de un form — sin schema/widgets/emailTemplate. Lo
 *  devuelve el endpoint `/folders?withForms=summary` para que el sidebar
 *  del HomePage no haga N+1 ni mueva payloads enormes al cargar la lista. */
export type FormSummaryData = {
  id: string;
  name: string;
  folderId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FolderWithFormsData = FolderData & {
  forms: FormSummaryData[];
  formsCount: number;
};

/**
 * Trae las carpetas de un proyecto. Por defecto incluye un resumen liviano
 * de los forms de cada carpeta + el conteo — el sidebar los consume así
 * sin disparar un request por carpeta.
 *
 * Para traer solo las carpetas (sin forms), pasa `{ withForms: false }`.
 */
export async function getFoldersByProject(
  projectId: string,
  opts: { withForms?: boolean } = { withForms: true },
) {
  if (opts.withForms === false) {
    return request<FolderData[]>(`/folders?projectId=${projectId}`);
  }
  return request<FolderWithFormsData[]>(
    `/folders?projectId=${projectId}&withForms=summary`,
  );
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

/** Trae un formulario individual con su schema/widgets/rules/emailTemplate
 *  completos. Se usa al abrir el Builder (los endpoints de lista traen un
 *  resumen liviano sin esos campos pesados). */
export async function getFormByIdApi(formId: string) {
  return request<FormApiData>(`/forms/${formId}`);
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

/** Excel (por correo) de los registros de UNA tarea. Sin fieldIds → todas las columnas. */
export async function requestTaskReportByEmailApi(
  formId: string,
  taskId: string,
  fieldIds: string[] = [],
) {
  return request<{ success: boolean; message: string; recipients: number }>(
    `/forms/${formId}/tasks/${taskId}/export-email`,
    { method: 'POST', body: JSON.stringify({ fieldIds }) },
  );
}

export type ReportDownloadMeta = {
  formName: string;
  expiresAt: string; // ISO date (reloj del servidor; informativo)
  // Milisegundos restantes calculados en el servidor en el instante en que
  // responde al GET /meta. El frontend debe usar este valor para armar el
  // countdown, no comparar `expiresAt` contra Date.now() del navegador — así
  // el flujo es inmune al clock-skew entre PC y servidor.
  remainingMs: number;
  kind?: 'excel' | 'bulk-pdf';
};

export async function getReportDownloadMetaApi(token: string) {
  return request<ReportDownloadMeta>(`/secure-downloads/${token}/meta`);
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
    const res = await fetch(`${API_URL}/secure-downloads/${token}`, {
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

// --- Assignments (Tree endpoints) ---

export type AssignmentsTreeDto = {
  projects: string[];
  folders: string[];
  forms: string[];
  excludedFolders: string[];
  excludedForms: string[];
};

export const getUserAssignmentsTreeApi = (userId: number) =>
  request<AssignmentsTreeDto>(`/users/${userId}/assignments/tree`);

export const putUserAssignmentsTreeApi = (
  userId: number,
  body: AssignmentsTreeDto,
) => request<{ ok: true }>(`/users/${userId}/assignments/tree`, { method: 'PUT', body: JSON.stringify(body) });

export const getGroupAssignmentsTreeApi = (groupId: string) =>
  request<AssignmentsTreeDto>(`/groups/${groupId}/assignments/tree`);

export const putGroupAssignmentsTreeApi = (
  groupId: string,
  body: AssignmentsTreeDto,
) => request<{ ok: true }>(`/groups/${groupId}/assignments/tree`, { method: 'PUT', body: JSON.stringify(body) });

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
  pdfFilename?: string,
): Promise<ApiResponse<SubmissionData>> {
  // NOTA: templateSnapshot ya no se envía desde el cliente. El backend lo
  // deriva de form.emailTemplate.pdfTemplate (server-side) para prevenir
  // inyección HTML/JS que después se renderizaba en Puppeteer.
  const body: Record<string, unknown> = { data };
  if (pdfFilename) body.pdfFilename = pdfFilename;
  return request<SubmissionData>(`/forms/${formId}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: apiKey ? { "X-API-Key": apiKey } : undefined,
  });
}

export type RecordRowDto = {
  id: string;
  submittedAt: string;
  userName: string;
  summary: Record<string, string>;
  hasPdf: boolean;
};

export type RecordsPageDto = {
  data: RecordRowDto[];
  total: number;
  page: number;
  limit: number;
};

export function getFormRecordsApi(
  formId: string,
  params: { page?: number; limit?: number; from?: string; to?: string; q?: string } = {},
): Promise<ApiResponse<RecordsPageDto>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<RecordsPageDto>(`/forms/${formId}/records${suffix}`);
}

export async function getSubmissionPdfBlobApi(
  id: string,
): Promise<{ blob: Blob | null; filename: string; error: string | null }> {
  const token = localStorage.getItem('token');
  try {
    const resp = await fetch(`${API_URL}/submissions/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (resp.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
      return { blob: null, filename: '', error: 'Sesión expirada' };
    }
    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      return { blob: null, filename: '', error: msg || `Error ${resp.status}` };
    }
    const blob = await resp.blob();
    const disp = resp.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^"]+)"?/i.exec(disp);
    return { blob, filename: match?.[1] ?? 'registro.pdf', error: null };
  } catch {
    return { blob: null, filename: '', error: 'No se pudo conectar con el servidor' };
  }
}

/**
 * Elimina una submission del formulario. Requiere motivo (mín 5, máx 300).
 * El motivo se guarda en el log de acciones administrativas para auditoría.
 */
export function deleteSubmissionApi(id: string, reason: string) {
  return request<{ ok: true }>(`/submissions/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export function requestBulkPdfApi(
  formId: string,
  filters: { from?: string; to?: string; q?: string },
): Promise<ApiResponse<{ ok: boolean; message: string }>> {
  // Backend responde 202 Accepted inmediatamente y procesa en background;
  // el resultado llega por correo, no en esta respuesta.
  return request<{ ok: boolean; message: string }>(
    `/forms/${formId}/records/bulk-pdf`,
    { method: 'POST', body: JSON.stringify(filters) },
  );
}

// --- Tareas ---

export function toggleTaskShareLinkApi(
  taskId: string,
  enabled: boolean,
  oneShot?: boolean,
) {
  const body: { enabled: boolean; oneShot?: boolean } = { enabled };
  if (oneShot !== undefined) body.oneShot = oneShot;
  return request<{ shareLinkUrl: string | null }>(
    `/tasks/${taskId}/share-link`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function cancelTaskApi(taskId: string) {
  return request<{ status: string }>(`/tasks/${taskId}/cancel`, { method: 'PATCH' });
}

export type TaskSummaryDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  totalRecipients: number;
  completedCount: number;
  pendingCount: number;
  hasShareLink: boolean;
};

export type TaskRecipientDto = {
  stepIndex: number;
  email: string;
  name: string;
  status: 'in_progress' | 'pending' | 'completed';
  submittedAt: string | null;
  canResend: boolean;
  lastResendAt: string | null;
};

export type TaskScoreWidgetDto = {
  id: string;
  label: string;
};

export type TaskSubmissionDto = {
  id: string;
  submittedAt: string;
  userName: string;
  hasPdf: boolean;
  summary: Record<string, string>;
  /** Correo del respondent que envió esta submission (solo tareas paralelas). */
  respondentEmail?: string;
  /** Data cruda del formulario — el frontend lee `data[widget.id]` para leer
   * la nota de widgets tipo quiz_score. */
  data?: Record<string, string>;
};

export type TaskDetailDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  shareLinkUrl: string | null;
  /** Persiste aunque `shareLinkUrl` sea null (link ya utilizado/desactivado). */
  shareLinkOneShot: boolean;
  recipients: TaskRecipientDto[];
  submissions: TaskSubmissionDto[];
  /** Externos (sin cuenta) que diligenciaron la tarea vía el enlace. */
  externalCount: number;
  /** Widgets tipo "quiz_score" del formulario. Si tiene al menos uno, el
   * frontend agrega columna Nota y tarjeta Promedio. */
  scoreWidgets: TaskScoreWidgetDto[];
};

export type TaskSummaryPageDto = {
  data: TaskSummaryDto[];
  total: number;
  page: number;
  limit: number;
};

export function getFormTasksApi(
  formId: string,
  params: { page?: number; limit?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<TaskSummaryPageDto>(`/tasks/by-form/${formId}${suffix}`);
}

export function getTaskDetailApi(taskId: string) {
  return request<TaskDetailDto>(`/tasks/${taskId}/detail`);
}

export function resendTaskStepApi(taskId: string, stepIndex: number) {
  return request<{ ok: true; sentAt: string }>(
    `/tasks/${taskId}/steps/${stepIndex}/resend`,
    { method: 'POST', body: '{}' },
  );
}

export function requestTaskBulkPdfApi(taskId: string) {
  return request<{ ok: true; message: string }>(
    `/tasks/${taskId}/bulk-pdf`,
    { method: 'POST', body: '{}' },
  );
}

// ─── Consentimientos (API dedicada, Plan 1) ──────────────────────────────
export type ConsentRecordDto = {
  id: string; tipo: string; entidad: "SAI" | "SOUL" | null;
  tipoDoc: string; numDoc: string; nombres: string; apellidos: string | null;
  ciudad: string | null; profesional: string | null; estado: string;
  respuestas: Record<string, unknown>;
  firmaPaciente: string | null; firmaResponsable: string | null; foto: string | null;
  hashVerificacion: string; createdAt: string; creadoPor?: string | null;
};
export type CreateConsentPayload = {
  tipo: string; entidad?: "SAI" | "SOUL";
  tipoDoc: string; numDoc: string; nombres: string; apellidos?: string;
  ciudad?: string; profesional?: string;
  respuestas: Record<string, unknown>;
  firmaPaciente: string; firmaResponsable?: string; foto?: string;
};

export function createConsentApi(payload: CreateConsentPayload) {
  return request<ConsentRecordDto>("/consents", { method: "POST", body: JSON.stringify(payload) });
}
export function listConsentsApi(params: {
  tipo?: string; search?: string; from?: string; to?: string; page?: number; limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") qs.set(k, String(v)); });
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ data: ConsentRecordDto[]; total: number; page: number; limit: number }>(`/consents${suffix}`);
}
export type VacunaPreviaDto = { vacuna: string; dosis: string; aplicada: string; proxima: string };
export type PacienteLookupDto = { ultimo: ConsentRecordDto | null; vacunas: VacunaPreviaDto[] };
/** `excludeId`: registro en edición, que no cuenta como historial. Un 401 aquí no redirige al login. */
export function lookupPacienteApi(numDoc: string, entidad?: "SOUL" | "SAI", excludeId?: string) {
  const qs = new URLSearchParams({ numDoc });
  if (entidad) qs.set("entidad", entidad);
  if (excludeId) qs.set("excludeId", excludeId);
  return request<PacienteLookupDto>(`/consents/paciente?${qs.toString()}`, { redirectOn401: false });
}
export function getConsentApi(id: string) {
  return request<ConsentRecordDto>(`/consents/${id}`);
}
export function updateConsentApi(id: string, payload: Partial<CreateConsentPayload>) {
  return request<ConsentRecordDto>(`/consents/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
export function anularConsentApi(id: string) {
  return request<ConsentRecordDto>(`/consents/${id}/anular`, { method: "POST" });
}
export function verifyConsentApi(id: string) {
  return request<{ valido: boolean; hash: string }>(`/consents/${id}/verificar`);
}
export type ConsentPdfPayload = {
  record: ConsentRecordDto;
  firmaPacienteDataUrl: string | null;
  firmaResponsableDataUrl: string | null;
  fotoDataUrl: string | null;
};
export function getConsentPdfPayloadApi(id: string) {
  return request<ConsentPdfPayload>(`/consents/${id}/pdf`);
}

// ─── API Keys (admin) ────────────────────────────────────────────────────────
// Pensadas para integraciones externas: el MCP de Claude, Power BI, SDK propio.
// Las keys se emiten UNA sola vez y queda en la UI responsabilidad de que el
// admin la copie en el momento — después solo quedan el nombre, estado y
// metadatos de uso.

export type ApiKeyDto = {
  id: string;
  key: string; // completo solo en el response del POST; en listados viene igual
  name: string;
  createdById: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listApiKeysApi() {
  return request<ApiKeyDto[]>(`/api-keys`);
}

export function createApiKeyApi(name: string) {
  return request<ApiKeyDto>(`/api-keys`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function revokeApiKeyApi(id: string) {
  return request<void>(`/api-keys/${id}`, { method: 'DELETE' });
}
