'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Save, Gift, Loader2 } from 'lucide-react';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';

import type { SystemConfig } from '@/types';
import {
  getRegistrationBonus,
  updateRegistrationBonus,
} from '@/lib/settingsApi';

type SystemConfigTabProps = {
  systemConfig: SystemConfig | null;
  setSystemConfig: React.Dispatch<React.SetStateAction<SystemConfig | null>>;
  updateSystemConfig: (config: Partial<SystemConfig>) => Promise<void>;
};

const SystemConfigTab: React.FC<SystemConfigTabProps> = ({
  systemConfig,
  setSystemConfig,
  updateSystemConfig,
}) => {
  const [registrationBonus, setRegistrationBonus] = useState<number>(100);
  const [bonusLoading, setBonusLoading] = useState(false);
  const [bonusSaving, setBonusSaving] = useState(false);

  useEffect(() => {
    const loadRegistrationBonus = async () => {
      setBonusLoading(true);
      try {
        const bonus = await getRegistrationBonus();
        setRegistrationBonus(bonus);
      } catch (error: unknown) {
        console.error('Failed to load registration bonus:', error);
        setRegistrationBonus(100);
      } finally {
        setBonusLoading(false);
      }
    };
    void loadRegistrationBonus();
  }, []);

  const saveRegistrationBonus = async () => {
    setBonusSaving(true);
    try {
      await updateRegistrationBonus(registrationBonus);
      toast.success('注册赠送积分配置已保存');
    } catch (error: unknown) {
      console.error('Failed to save registration bonus:', error);
      toast.error('保存注册赠送积分配置失败');
    } finally {
      setBonusSaving(false);
    }
  };

  if (!systemConfig) {
    return (
      <div className="card-primary p-6">
        <DetailSkeleton sections={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="mb-6 text-lg font-semibold text-text-primary">系统配置管理</h3>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-primary p-6">
          <h4 className="mb-6 flex items-center gap-2 text-xl font-semibold text-text-primary">
            <Zap className="h-5 w-5 text-accent" />
            任务处理配置
          </h4>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">最大并发任务数</label>
              <input
                type="number"
                value={systemConfig.max_concurrent_tasks}
                onChange={(e) =>
                  setSystemConfig({
                    ...systemConfig,
                    max_concurrent_tasks: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-primary w-full px-4 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">任务超时时间（秒）</label>
              <input
                type="number"
                value={systemConfig.task_timeout}
                onChange={(e) =>
                  setSystemConfig({
                    ...systemConfig,
                    task_timeout: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-primary w-full px-4 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">清理间隔（秒）</label>
              <input
                type="number"
                value={systemConfig.cleanup_interval}
                onChange={(e) =>
                  setSystemConfig({
                    ...systemConfig,
                    cleanup_interval: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-primary w-full px-4 py-2"
              />
            </div>
          </div>
        </div>

        <div className="card-primary p-6">
          <h4 className="mb-6 flex items-center gap-2 text-xl font-semibold text-text-primary">
            <Gift className="h-5 w-5 text-accent" />
            新用户注册配置
          </h4>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">注册赠送积分</label>
              {bonusLoading ? (
                <div className="flex items-center gap-2 text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中...
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  value={registrationBonus}
                  onChange={(e) => setRegistrationBonus(parseInt(e.target.value, 10) || 0)}
                  className="input-primary w-full px-4 py-2"
                />
              )}
            </div>

            <button onClick={saveRegistrationBonus} disabled={bonusSaving || bonusLoading} className="btn-primary flex items-center gap-2">
              {bonusSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={16} />
                  保存配置
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      <div className="flex justify-end">
        <button onClick={() => updateSystemConfig(systemConfig)} className="btn-primary">
          <Save size={16} className="mr-2" />
          保存配置
        </button>
      </div>
    </div>
  );
};

export default SystemConfigTab;
