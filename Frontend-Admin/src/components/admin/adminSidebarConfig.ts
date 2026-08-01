import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Coins,
  ImagePlus,
  LayoutDashboard,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import type { User } from '@/types';

export type AdminSidebarModule = {
  name: string;
  icon: LucideIcon;
  href: string;
  description: string;
  color: string;
  requiredPermission?: string;
};

export const adminSidebarModules: AdminSidebarModule[] = [
  {
    name: '仪表盘',
    icon: LayoutDashboard,
    href: '/',
    description: '核心指标概览',
    color: 'from-purple-500 to-blue-500',
    requiredPermission: 'admin.dashboard.read',
  },
  {
    name: '生成任务',
    icon: RefreshCcw,
    href: '/tasks',
    description: '请求、队列与结果追踪',
    color: 'from-green-500 to-teal-500',
    requiredPermission: 'admin.tasks.read',
  },
  {
    name: '模板与模型',
    icon: ImagePlus,
    href: '/template',
    description: '玩法模板与模型配置',
    color: 'from-orange-500 to-red-500',
    requiredPermission: 'admin.resources.read',
  },
  {
    name: '源头监控与调度',
    icon: Workflow,
    href: '/dispatch',
    description: '模型路由、源头运行与调度',
    color: 'from-fuchsia-500 to-pink-500',
    requiredPermission: 'admin.dispatch.read',
  },
  {
    name: '内容审核',
    icon: ShieldCheck,
    href: '/moderation',
    description: '输入输出内容审查',
    color: 'from-cyan-500 to-blue-500',
    requiredPermission: 'admin.moderation.read',
  },
  {
    name: '系统配置',
    icon: Settings,
    href: '/system',
    description: '任务超时与运行参数',
    color: 'from-violet-500 to-purple-500',
    requiredPermission: 'admin.system.read',
  },
  {
    name: '资源监控',
    icon: Activity,
    href: '/monitor',
    description: '主机与容器实时状态',
    color: 'from-teal-500 to-emerald-500',
    requiredPermission: 'admin.monitor.read',
  },
  {
    name: '用户管理',
    icon: Users,
    href: '/users',
    description: '用户、余额与状态管理',
    color: 'from-blue-500 to-indigo-500',
    requiredPermission: 'admin.users.read',
  },
  {
    name: '积分与兑换',
    icon: Coins,
    href: '/finance',
    description: '积分流水与兑换码',
    color: 'from-yellow-500 to-orange-500',
    requiredPermission: 'admin.finance.read',
  },
];

export const getAccessibleAdminSidebarModules = (user: User | null): AdminSidebarModule[] =>
  user ? adminSidebarModules : [];

export const findAdminSidebarModuleByName = (moduleName: string): AdminSidebarModule | undefined =>
  adminSidebarModules.find((module) => module.name === moduleName);

export const findAdminSidebarModuleByHref = (href: string): AdminSidebarModule | undefined =>
  adminSidebarModules.find((module) => module.href === href);
