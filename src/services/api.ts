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

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        data: null,
        error: body.message || `Error ${response.status}`,
      };
    }

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
