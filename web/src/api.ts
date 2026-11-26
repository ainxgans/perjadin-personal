export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: string;
}

export interface Trip {
  id: string;
  nama: string;
  tujuan: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
  uang_dinas: number | null;
  nominal_monita: number | null;
  estimasi_transport?: number | null;
  dokumen_url?: string | null;
  dokumen_nama?: string | null;
  tanggal_dibayar: string | null;
  catatan: string;
  link_monita: string;
  settlement_note: string;
  total_pengeluaran: number;
  pengeluaran_pribadi?: number;
  talangan_koperasi?: number;
  saldo: number;
  is_owner?: boolean;
  owner_name?: string;
  collaborators_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  can_edit?: boolean;
  category_id: string;
  category_nama: string;
  payment_method_id: string;
  payment_method_nama: string;
  deskripsi: string;
  jumlah: number;
  tanggal: string;
  created_at: string;
}

export interface SBMRate {
  id: string;
  provinsi: string;
  ibukota: string;
  kota?: string[];
  uang_harian: number;
  uang_transport: number;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  nama: string;
  owner_id: string;
  join_code?: string;
  role?: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string;
  role: string;
  created_at: string;
}

export interface CurrentWorkspaceData {
  workspace: Workspace;
  members: WorkspaceMember[];
  join_code?: string;
}

export interface UserSearchItem {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: string;
}

export interface Category {
  id: string;
  nama: string;
}

export interface PaymentMethod {
  id: string;
  nama: string;
}

export interface Dashboard {
  belum_lunas: number;
  pemasukan_bulan_lalu: number;
  estimasi_belum_cair: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: string;
  created_at: string;
  trip_count: number;
}

export interface AdminStats {
  total_users: number;
  total_trips: number;
  total_expenses_rp: number;
  total_uang_dinas_rp: number;
}

export interface CategorySpending {
  category_id: string;
  category_nama: string;
  total: number;
  percentage: number;
}

export interface PaymentMethodSpending {
  payment_method_id: string;
  payment_method_nama: string;
  total: number;
  percentage: number;
}

export interface AnalyticsData {
  total_expenses_rp: number;
  total_uang_dinas_rp: number;
  average_expense_trip: number;
  total_days: number;
  total_trips?: number;
  daily_burn_rate: number;
  personal_share_pct: number;
  budget_realization_pct: number;
  categories: CategorySpending[];
  payment_methods: PaymentMethodSpending[];
  available_years?: number[];
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const activeWsId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_workspace_id') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers as Record<string, string> || {}),
  };
  if (activeWsId && !headers['X-Workspace-ID']) {
    headers['X-Workspace-ID'] = activeWsId;
  }

  const res = await fetch(path, {
    ...opts,
    credentials: 'same-origin',
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export interface ParseDocumentResult {
  doc_type: string;
  nomor_surat: string;
  nama: string;
  tujuan: string;
  lokasi_raw: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  catatan: string;
  dokumen_url?: string;
  dokumen_nama?: string;
}

// Auth
export const getMe = () => apiFetch<User>('/auth/me');
export const logout = () => fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });

// Dashboard & Analytics
export const getDashboard = () => apiFetch<Dashboard>('/api/dashboard');
export const getAnalytics = (year?: number) => {
  const query = typeof year === 'number' && year > 0 ? `?year=${year}` : '';
  return apiFetch<AnalyticsData>(`/api/analytics${query}`);
};

// Trips
export const getTrips = () => apiFetch<Trip[]>('/api/trips');
export const getTrip = (id: string) => apiFetch<Trip>(`/api/trips/${id}`);
export const createTrip = (data: Partial<Trip>) => apiFetch<Trip>('/api/trips', { method: 'POST', body: JSON.stringify(data) });
export const updateTrip = (id: string, data: Partial<Trip>) => apiFetch<Trip>(`/api/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTrip = (id: string) => apiFetch<void>(`/api/trips/${id}`, { method: 'DELETE' });
export const parseDocument = async (file: File): Promise<ParseDocumentResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/trips/parse-document', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
};

// Expenses
export const getExpenses = (tripId: string) => apiFetch<Expense[]>(`/api/trips/${tripId}/expenses`);
export const createExpense = (tripId: string, data: Partial<Expense>) => apiFetch<Expense>(`/api/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(data) });
export const updateExpense = (id: string, data: Partial<Expense>) => apiFetch<Expense>(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteExpense = (id: string) => apiFetch<void>(`/api/expenses/${id}`, { method: 'DELETE' });

// Master data
export const getCategories = () => apiFetch<Category[]>('/api/categories');
export const getPaymentMethods = () => apiFetch<PaymentMethod[]>('/api/payment-methods');
export const getSBMRates = (q?: string) => {
  const query = typeof q === 'string' && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return apiFetch<SBMRate[]>(`/api/sbm${query}`);
};
export const createSBMRate = (data: Partial<SBMRate>) => apiFetch<SBMRate>('/api/admin/sbm', { method: 'POST', body: JSON.stringify(data) });
export const updateSBMRate = (id: string, data: Partial<SBMRate>) => apiFetch<SBMRate>(`/api/admin/sbm/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSBMRate = (id: string) => apiFetch<void>(`/api/admin/sbm/${id}`, { method: 'DELETE' });

// Users search
export const searchUsers = (q?: string) => {
  const query = typeof q === 'string' && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return apiFetch<UserSearchItem[]>(`/api/users${query}`);
};

// Workspaces
export const getWorkspaces = () => apiFetch<Workspace[]>('/api/workspaces');
export const createWorkspace = (data: { nama: string }) => apiFetch<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(data) });
export const getCurrentWorkspace = () => apiFetch<CurrentWorkspaceData>('/api/workspaces/current');
export const joinWorkspace = (code: string) => apiFetch<Workspace>('/api/workspaces/join', { method: 'POST', body: JSON.stringify({ code }) });
export const regenerateJoinCode = () => apiFetch<{ join_code: string }>('/api/workspaces/regenerate-code', { method: 'POST' });
export const removeWorkspaceMember = (workspaceId: string, userId: string) => apiFetch<void>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });

// Admin
export const getAdminUsers = () => apiFetch<AdminUser[]>('/api/admin/users');
export const updateUserRole = (id: string, role: string) => apiFetch<{ id: string; role: string }>(`/api/admin/users/${id}/role`, {
  method: 'PUT',
  body: JSON.stringify({ role }),
});
export const getAdminStats = () => apiFetch<AdminStats>('/api/admin/stats');
export const createAdminUser = (data: { email: string; name: string; role: 'admin' | 'user' }) =>
  apiFetch<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const createCategory = (nama: string) => apiFetch<Category>('/api/admin/categories', { method: 'POST', body: JSON.stringify({ nama }) });
export const updateCategory = (id: string, nama: string) => apiFetch<Category>(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify({ nama }) });
export const deleteCategoryApi = (id: string) => apiFetch<void>(`/api/admin/categories/${id}`, { method: 'DELETE' });
export const createPaymentMethod = (nama: string) => apiFetch<PaymentMethod>('/api/admin/payment-methods', { method: 'POST', body: JSON.stringify({ nama }) });
export const updatePaymentMethod = (id: string, nama: string) => apiFetch<PaymentMethod>(`/api/admin/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify({ nama }) });
export const deletePaymentMethodApi = (id: string) => apiFetch<void>(`/api/admin/payment-methods/${id}`, { method: 'DELETE' });
