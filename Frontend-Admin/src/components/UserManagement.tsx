'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CreditCard,
  DollarSign,
  Edit3,
  Eye,
  RefreshCcw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { TableSkeleton } from '@/components/ui/Skeleton';
import apiClient from '@/lib/api';
import { PaginatedResponse, User } from '@/types';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
import { formatChinaDate as formatDate, formatChinaDateTime as formatDateTime } from '@/utils/format';

import { FilterStatus, EditableStatus, UserStats } from './UserManagementTypes';
import { emptyStats, emptyCreditForm, getDisplayName, getLoginAccount, getRegistrationSourceLabel, getInitial, getStatus, getAdminNote } from './UserManagementUtils';
import { StatCard, Modal, OverlayCard, Field, DetailItem } from './UserManagementComponents';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>(emptyStats);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdjustingCredits, setIsAdjustingCredits] = useState(false);

  const [editStatus, setEditStatus] = useState<EditableStatus>('active');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [creditForm, setCreditForm] = useState(emptyCreditForm);

  const fetchUsers = useCallback(async (page: number) => {
    const response: PaginatedResponse<User> = await apiClient.system.getAllUsers(page, 20);
    setUsers(response.items || []);
    const total = Number(response.total || 0);
    const pageSize = Math.max(Number(response.page_size || 20), 1);
    setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
    setLastUpdatedAt(new Date());
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      await fetchUsers(currentPage);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '加载用户列表失败'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, fetchUsers]);

  const loadStats = useCallback(async () => {
    try {
      const payload = await apiClient.finance.getStatistics(30);
      const usersPayload = (payload?.users || {}) as Record<string, unknown>;
      const totalUsers = Number(usersPayload?.total || 0);
      const totalCredits = Number(usersPayload?.total_credits || 0);
      setStats({
        totalUsers,
        activeUsers: Number(usersPayload?.active || usersPayload?.recent_active || 0),
        bannedUsers: Number(usersPayload?.banned || 0),
        adminUsers: Number(usersPayload?.admin || 0),
        totalCredits,
        todayRegistrations: Number(usersPayload?.today_registrations || 0),
        averageCreditsPerUser: totalUsers > 0 ? Math.round(totalCredits / totalUsers) : 0,
        usersWithLowCredits: Number(usersPayload?.low_credits || 0),
      });
      setLastUpdatedAt(new Date());
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '加载用户统计失败'));
    }
  }, []);

  const refreshAll = useCallback(async (page = currentPage) => {
    setRefreshing(true);
    try {
      await Promise.all([fetchUsers(page), loadStats()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '刷新用户数据失败'));
    } finally {
      setRefreshing(false);
    }
  }, [currentPage, fetchUsers, loadStats]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void refreshAll();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refreshAll]);

  const filteredUsers = users.filter((user) => {
    const keyword = searchTerm.trim().toLowerCase();
    const displayName = getDisplayName(user).toLowerCase();
    const matchesSearch =
      !keyword
      || user.email.toLowerCase().includes(keyword)
      || displayName.includes(keyword)
      || getAdminNote(user).toLowerCase().includes(keyword)
      || String(user.id).includes(keyword);

    const status = getStatus(user);
    const matchesFilter =
      filterStatus === 'all'
      || (filterStatus === 'active' && status === 'active')
      || (filterStatus === 'banned' && status === 'banned');

    return matchesSearch && matchesFilter;
  });

  const openDetailModal = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditStatus(getStatus(user));
    setEditAdminNote(getAdminNote(user));
    setShowEditModal(true);
  };

  const openCreditModal = (user: User) => {
    setSelectedUser(user);
    setCreditForm(emptyCreditForm());
    setShowCreditModal(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    try {
      if (editAdminNote.trim() !== getAdminNote(selectedUser)) {
        await apiClient.system.updateUserAdminNote(String(selectedUser.id), editAdminNote.trim());
      }
      if (editStatus !== getStatus(selectedUser)) {
        await apiClient.system.updateUserStatus(String(selectedUser.id), editStatus);
      }
      toast.success('用户信息已更新');
      setShowEditModal(false);
      await refreshAll();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '更新用户失败'));
    }
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser || isAdjustingCredits) return;
    try {
      setIsAdjustingCredits(true);
      await apiClient.system.adjustUserCredits(String(selectedUser.id), creditForm.credits, creditForm.reason);
      toast.success('积分调整成功');
      setShowCreditModal(false);
      await refreshAll();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '积分调整失败'));
    } finally {
      setIsAdjustingCredits(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setIsDeleting(true);
      await apiClient.system.deleteUser(String(selectedUser.id));
      toast.success(`用户 ${selectedUser.email} 已删除`);
      setShowDeleteModal(false);
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        await refreshAll(1);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '删除用户失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="总用户数" value={stats.totalUsers.toLocaleString()} icon={Users} meta={`今日新增 ${stats.todayRegistrations}`} />
        <StatCard title="活跃用户" value={stats.activeUsers.toLocaleString()} icon={Activity} meta={`管理员 ${stats.adminUsers}`} />
        <StatCard title="总积分" value={stats.totalCredits.toLocaleString()} icon={CreditCard} meta={`人均 ${stats.averageCreditsPerUser}`} />
        <StatCard title="低余额用户" value={stats.usersWithLowCredits.toLocaleString()} icon={TrendingUp} meta={`封禁 ${stats.bannedUsers}`} />
      </div>

      <div className="card-primary space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
              <Users className="h-5 w-5 text-accent" />
              用户列表
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              最后更新：{lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '-'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void refreshAll()} disabled={refreshing} className="btn-secondary-sm flex items-center">
              <RefreshCcw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button onClick={() => setAutoRefresh((value) => !value)} className="btn-secondary-sm">
              自动刷新：{autoRefresh ? '开' : '关'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="搜索邮箱、用户名或用户 ID"
              className="w-full rounded-lg border border-white/10 bg-surface/50 py-2 pl-10 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}
            className="rounded-lg border border-white/10 bg-surface/50 px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="all">全部用户</option>
            <option value="active">正常用户</option>
            <option value="banned">封禁用户</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-sm text-text-muted">
                <th className="py-3">用户</th>
                <th className="py-3">用户ID</th>
                <th className="py-3">积分</th>
                <th className="py-3">状态</th>
                <th className="py-3">备注</th>
                <th className="py-3">注册时间</th>
                <th className="py-3">最近登录</th>
                <th className="py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4">
                    <TableSkeleton rows={6} columns={7} />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-text-muted">暂无匹配用户</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const displayName = getDisplayName(user);
                  const loginAccount = getLoginAccount(user);
                  const status = getStatus(user);
                  const adminNote = getAdminNote(user);
                  return (
                    <tr key={user.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                            <span className="text-xs font-medium text-white">{getInitial(user)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">{displayName}</p>
                            <p className="text-sm text-text-muted">{loginAccount}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-sm text-text-muted">{String(user.id)}</td>
                      <td className="py-4">{Number(user.credits || 0).toLocaleString()}</td>
                      <td className="py-4">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-medium ${
                            status === 'banned'
                              ? 'border-red-500/30 bg-red-500/20 text-red-400'
                              : 'border-green-500/30 bg-green-500/20 text-green-400'
                          }`}
                        >
                          {status === 'banned' ? '已封禁' : '正常'}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-text-muted">
                        <div className="max-w-[240px] truncate" title={adminNote || '暂无备注'}>
                          {adminNote || '-'}
                        </div>
                      </td>
                      <td className="py-4 text-sm text-text-muted">{formatDate(user.created_at)}</td>
                      <td className="py-4 text-sm text-text-muted">{formatDateTime(user.last_login)}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openDetailModal(user)} className="rounded-lg p-1 transition-colors hover:bg-white/10" title="查看详情">
                            <Eye className="h-4 w-4 text-text-muted" />
                          </button>
                          <button onClick={() => openEditModal(user)} className="rounded-lg p-1 transition-colors hover:bg-white/10" title="编辑用户">
                            <Edit3 className="h-4 w-4 text-text-muted" />
                          </button>
                          <button onClick={() => openCreditModal(user)} className="rounded-lg p-1 transition-colors hover:bg-white/10" title="调整积分">
                            <DollarSign className="h-4 w-4 text-text-muted" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="rounded-lg p-1 transition-colors hover:bg-white/10"
                            title="删除用户"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div className="text-sm text-text-muted">第 {currentPage} 页，共 {totalPages} 页</div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-white/10 bg-surface/50 px-3 py-1 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-white/10 bg-surface/50 px-3 py-1 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {showDetailModal && selectedUser && (
        <OverlayCard title="用户详情" onClose={() => setShowDetailModal(false)}>
          <div className="space-y-3">
            <DetailItem label="用户 ID" value={String(selectedUser.id)} />
            <DetailItem label="邮箱" value={selectedUser.email || '-'} />
            <DetailItem label="用户名" value={String(selectedUser.username || '-')} />
            <DetailItem label="登录账号" value={getLoginAccount(selectedUser)} />
            <DetailItem label="注册来源" value={getRegistrationSourceLabel(selectedUser)} />
            <DetailItem label="状态" value={getStatus(selectedUser) === 'banned' ? '已封禁' : '正常'} />
            <DetailItem label="积分" value={Number(selectedUser.credits || 0).toLocaleString()} />
            <DetailItem label="管理员备注" value={getAdminNote(selectedUser) || '-'} />
            <DetailItem label="注册时间" value={formatDateTime(selectedUser.created_at)} />
            <DetailItem label="最近登录" value={formatDateTime(selectedUser.last_login)} />
            <DetailItem label="登录次数" value={String(selectedUser.login_count || 0)} />
          </div>
        </OverlayCard>
      )}

      {showEditModal && selectedUser && (
        <Modal title="编辑用户" onClose={() => setShowEditModal(false)} onConfirm={handleEditUser}>
          <div className="space-y-4">
            <Field label="状态">
              <select
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as EditableStatus)}
                className="w-full rounded-lg border border-white/10 bg-surface/50 px-3 py-2"
              >
                <option value="active">正常</option>
                <option value="banned">封禁</option>
              </select>
            </Field>
            <Field label="管理员备注">
              <textarea
                rows={4}
                maxLength={2000}
                value={editAdminNote}
                onChange={(event) => setEditAdminNote(event.target.value)}
                placeholder="仅管理员可见"
                className="w-full rounded-lg border border-white/10 bg-surface/50 px-3 py-2"
              />
            </Field>
          </div>
        </Modal>
      )}

      {showCreditModal && selectedUser && (
        <Modal
          title="调整积分"
          onClose={() => !isAdjustingCredits && setShowCreditModal(false)}
          onConfirm={handleAdjustCredits}
          isLoading={isAdjustingCredits}
          confirmText="确认调整"
          loadingText="调整中..."
        >
          <div className="space-y-4">
            <Field label="积分变化">
              <input
                type="number"
                value={creditForm.credits || ''}
                onChange={(event) => setCreditForm((current) => ({ ...current, credits: Number.parseInt(event.target.value, 10) || 0 }))}
                className="w-full rounded-lg border border-white/10 bg-surface/50 px-3 py-2"
              />
            </Field>
            <Field label="原因">
              <textarea
                rows={3}
                value={creditForm.reason}
                onChange={(event) => setCreditForm((current) => ({ ...current, reason: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-surface/50 px-3 py-2"
              />
            </Field>
          </div>
        </Modal>
      )}

      {showDeleteModal && selectedUser && (
        <Modal
          title="删除用户确认"
          onClose={() => !isDeleting && setShowDeleteModal(false)}
          onConfirm={handleDeleteUser}
          isLoading={isDeleting}
          confirmText="确认删除"
          loadingText="删除中..."
        >
          <p className="text-sm text-text-primary">
            确定要删除用户 <span className="font-semibold">{getDisplayName(selectedUser)}</span> 吗？该操作不可撤销。
          </p>
        </Modal>
      )}
    </div>
  );
};

export default UserManagement;
