export type FilterStatus = 'all' | 'active' | 'banned';
export type EditableStatus = 'active' | 'banned';

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  adminUsers: number;
  totalCredits: number;
  todayRegistrations: number;
  averageCreditsPerUser: number;
  usersWithLowCredits: number;
}
