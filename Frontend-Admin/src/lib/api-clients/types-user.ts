export interface User {
  id: number | string;
  email: string;
  username?: string;
  login_account?: string;
  registration_source?: string;
  registration_source_label?: string;
  admin_note?: string;
  credits: number;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  is_active: boolean;
  // 管理端派生字段，不对应 users 表列
  status?: string;
  login_count?: number;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}
