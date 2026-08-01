'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronUp, LucideIcon, Sparkles } from 'lucide-react';

interface AdminModule {
  name: string;
  icon: LucideIcon;
  href: string;
  description: string;
  color: string;
  requiredPermission?: string;
}

interface SidebarProps {
  user: { username?: string } | null;
  activeModule: string;
  adminModules: AdminModule[];
  onModuleChange: (moduleName: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeModule,
  adminModules,
  onModuleChange,
  onLogout,
}) => {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const visibleModules = user ? adminModules : [];
  const displayName = user?.username || 'admin';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showUserMenu) {
        return;
      }

      const target = event.target as Element;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  return (
    <div className="w-64 flex-shrink-0 bg-surface/80 backdrop-blur-md text-text-primary h-screen sticky top-0 border-r border-white/5 p-4 flex flex-col overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 mb-8 p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-text-primary">即变</span>
          <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">Admin</span>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
          {visibleModules.map((module) => {
            const isActive = activeModule === module.name;
            return (
              <button
                key={module.name}
                onClick={() => onModuleChange(module.name)}
                className={`group flex items-center p-3 rounded-xl transition-all duration-200 w-full text-left ${
                  isActive
                    ? `bg-gradient-to-r ${module.color} text-white font-medium shadow-lg`
                    : 'text-text-secondary hover:bg-white/10 hover:text-white'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                  }`}
                >
                  <module.icon className="w-4 h-4" />
                </div>
                <div className="ml-3">
                  <p className="font-medium">{module.name}</p>
                  <p className="text-xs opacity-80">{module.description}</p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-white/10 mt-auto">
        <div className="relative user-menu-container">
          <button
            onClick={() => setShowUserMenu((current) => !current)}
            className="flex items-center w-full p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/10 transition duration-200"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mr-3">
              {displayName.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-text-primary">{displayName}</p>
              <p className="text-xs text-text-muted truncate">管理员账号</p>
            </div>
            <ChevronUp className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-white/10 rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout();
                  router.push('/');
                }}
                className="flex items-center w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
