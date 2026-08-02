import { User } from '@/types';

import { EditableStatus, UserStats } from './UserManagementTypes';

export const emptyStats = (): UserStats => ({
  totalUsers: 0,
  activeUsers: 0,
  bannedUsers: 0,
  adminUsers: 0,
  totalCredits: 0,
  todayRegistrations: 0,
  averageCreditsPerUser: 0,
  usersWithLowCredits: 0,
});

export const emptyCreditForm = () => ({
  credits: 0,
  reason: '',
});

export const getDisplayName = (user: User): string => {
  const username = String(user.username || '').trim();
  if (username) return username;
  const loginAccount = String(user.login_account || '').trim();
  if (loginAccount) return loginAccount;
  const email = String(user.email || '').trim();
  return email || '未知用户';
};

export const getLoginAccount = (user: User): string => {
  const loginAccount = String(user.login_account || '').trim();
  if (loginAccount) return loginAccount;

  const email = String(user.email || '').trim();
  if (email) return email;

  const username = String(user.username || '').trim();
  return username || '未知账号';
};

export const getRegistrationSourceLabel = (user: User): string => {
  const explicitLabel = String(user.registration_source_label || '').trim();
  if (explicitLabel) return explicitLabel;

  const source = String(user.registration_source || '').trim().toLowerCase();
  if (source === 'wechat') return '微信小程序';
  return '微信小程序';
};

export const getInitial = (user: User): string => getDisplayName(user).charAt(0).toUpperCase() || 'U';

export const getStatus = (user: User): EditableStatus => (user.is_active ? 'active' : 'banned');

export const getAdminNote = (user: User): string => String(user.admin_note || '').trim();
