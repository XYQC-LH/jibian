'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Lock, Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  loading: boolean;
}

interface AdminLoginFormData {
  username: string;
  password: string;
}

export default function AdminLogin({ onLogin, loading }: AdminLoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>();

  const handleLogin = async (data: AdminLoginFormData) => {
    await onLogin(data.username, data.password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-radial"></div>

      {/* 登录表单容器 */}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-500 shadow-[0_18px_60px_rgba(168,85,247,0.28)]">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">即变管理员登录</h1>
          <p className="text-text-muted">模板、任务、积分和审核管理</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit(handleLogin)} className="space-y-6">
            {/* 账户名输入 */}
            <div className="space-y-2">
              <label htmlFor="admin-username" className="text-sm font-medium text-text-primary">
                管理员账号
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <User size={18} className="text-text-muted" />
                </div>
                <input
                  id="admin-username"
                  type="text"
                  placeholder="请输入管理员账号"
                  className="input-primary w-full pl-10"
                  {...register('username', {
                    required: '请输入管理员账号',
                  })}
                  disabled={loading}
                />
              </div>
              {errors.username && (
                <p className="text-sm text-orange-400">{errors.username.message}</p>
              )}
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <label htmlFor="admin-password" className="text-sm font-medium text-text-primary">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-text-muted" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-primary w-full pl-10 pr-10"
                  {...register('password', {
                    required: '请输入密码',
                    minLength: {
                      value: 6,
                      message: '密码至少需要6个字符',
                    },
                  })}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-text-primary transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-orange-400">{errors.password.message}</p>
              )}
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base font-medium shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  登录中...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <LogIn size={18} />
                  管理员登录
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
