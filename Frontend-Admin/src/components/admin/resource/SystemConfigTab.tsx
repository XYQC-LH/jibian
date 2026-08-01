'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Database, Save, Gift, Loader2, KeyRound, Copy, RefreshCcw } from 'lucide-react';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';

import type { SystemConfig } from '@/types';
import {
  generateXianyuInternalApiKey,
  getRegistrationBonus,
  getXianyuInternalApiKey,
  updateRegistrationBonus,
  updateXianyuInternalApiKey,
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
  const [internalApiKey, setInternalApiKey] = useState('');
  const [internalApiKeySource, setInternalApiKeySource] = useState<'system_setting' | 'environment' | 'unset'>('unset');
  const [internalApiKeyLoading, setInternalApiKeyLoading] = useState(false);
  const [internalApiKeySaving, setInternalApiKeySaving] = useState(false);
  const [internalApiKeyGenerating, setInternalApiKeyGenerating] = useState(false);

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

  useEffect(() => {
    const loadInternalApiKey = async () => {
      setInternalApiKeyLoading(true);
      try {
        const payload = await getXianyuInternalApiKey();
        setInternalApiKey(payload.value);
        setInternalApiKeySource(
          payload.source === 'system_setting' || payload.source === 'environment' ? payload.source : 'unset'
        );
      } catch (error: unknown) {
        console.error('Failed to load xianyu internal api key:', error);
        setInternalApiKey('');
        setInternalApiKeySource('unset');
      } finally {
        setInternalApiKeyLoading(false);
      }
    };
    void loadInternalApiKey();
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

  const saveInternalApiKey = async () => {
    const normalized = String(internalApiKey || '').trim();
    if (normalized.length < 16) {
      toast.error('内部 API Key 长度至少需要 16 个字符');
      return;
    }

    setInternalApiKeySaving(true);
    try {
      const payload = await updateXianyuInternalApiKey(normalized);
      setInternalApiKey(payload.value);
      setInternalApiKeySource(payload.source === 'environment' ? 'environment' : 'system_setting');
      toast.success('内部 API Key 已保存');
    } catch (error: unknown) {
      console.error('Failed to save xianyu internal api key:', error);
      toast.error('保存内部 API Key 失败');
    } finally {
      setInternalApiKeySaving(false);
    }
  };

  const generateInternalApiKey = async () => {
    setInternalApiKeyGenerating(true);
    try {
      const payload = await generateXianyuInternalApiKey();
      setInternalApiKey(payload.value);
      setInternalApiKeySource('system_setting');
      toast.success('已生成新的内部 API Key');
    } catch (error: unknown) {
      console.error('Failed to generate xianyu internal api key:', error);
      toast.error('生成内部 API Key 失败');
    } finally {
      setInternalApiKeyGenerating(false);
    }
  };

  const copyInternalApiKey = async () => {
    const normalized = String(internalApiKey || '').trim();
    if (!normalized) {
      toast.error('当前没有可复制的内部 API Key');
      return;
    }
    try {
      await navigator.clipboard.writeText(normalized);
      toast.success('内部 API Key 已复制');
    } catch (error: unknown) {
      console.error('Failed to copy xianyu internal api key:', error);
      toast.error('复制内部 API Key 失败');
    }
  };

  const internalApiKeySourceLabel =
    internalApiKeySource === 'system_setting'
      ? '系统设置'
      : internalApiKeySource === 'environment'
        ? '环境变量回退'
        : '未配置';

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
            <Database className="h-5 w-5 text-accent" />
            资源限制配置
          </h4>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">Redis 内存限制</label>
              <input
                type="text"
                value={systemConfig.redis_memory_limit}
                onChange={(e) =>
                  setSystemConfig({
                    ...systemConfig,
                    redis_memory_limit: e.target.value,
                  })
                }
                className="input-primary w-full px-4 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">数据库连接数</label>
              <input
                type="number"
                value={systemConfig.database_connections}
                onChange={(e) =>
                  setSystemConfig({
                    ...systemConfig,
                    database_connections: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-primary w-full px-4 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">文件存储限制</label>
              <input
                type="text"
                value={systemConfig.file_storage_limit}
                onChange={(e) =>
                  setSystemConfig({
                    ...systemConfig,
                    file_storage_limit: e.target.value,
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

        <div className="card-primary p-6 lg:col-span-2">
          <h4 className="mb-6 flex items-center gap-2 text-xl font-semibold text-text-primary">
            <KeyRound className="h-5 w-5 text-accent" />
            即变内部 API Key
          </h4>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-text-muted">
              这组 Key 用于内部服务调用即变管理接口。你在这里保存或生成后，把同一个值配置到调用方的
              <span className="mx-1 font-mono text-text-primary">JIBIAN_INTERNAL_API_KEY</span>
              即可。
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">内部 API Key</label>
                {internalApiKeyLoading ? (
                  <div className="flex items-center gap-2 text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载中...
                  </div>
                ) : (
                  <input
                    type="text"
                    value={internalApiKey}
                    onChange={(e) => setInternalApiKey(e.target.value)}
                    placeholder="请输入至少 16 位的内部 API Key"
                    className="input-primary w-full px-4 py-2 font-mono"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="mb-2 block text-sm font-medium text-text-primary">当前来源</label>
                <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-primary">
                  {internalApiKeySourceLabel}
                </div>
                <div className="text-xs text-text-muted">
                  {internalApiKeySource === 'environment'
                    ? '当前读取的是后端环境变量，点击保存后会切换为系统设置托管。'
                    : internalApiKeySource === 'system_setting'
                      ? '当前读取的是系统设置里保存的平台级 Key。'
                      : '当前还没有可用的内部 API Key。'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={saveInternalApiKey}
                disabled={internalApiKeyLoading || internalApiKeySaving || internalApiKeyGenerating}
                className="btn-primary flex items-center gap-2"
              >
                {internalApiKeySaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    保存 Key
                  </>
                )}
              </button>

              <button
                onClick={generateInternalApiKey}
                disabled={internalApiKeyLoading || internalApiKeySaving || internalApiKeyGenerating}
                className="btn-secondary-sm border border-white/10"
              >
                {internalApiKeyGenerating ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <RefreshCcw size={16} className="mr-2" />
                )}
                生成新 Key
              </button>

              <button
                onClick={copyInternalApiKey}
                disabled={internalApiKeyLoading || !String(internalApiKey || '').trim()}
                className="btn-secondary-sm border border-white/10"
              >
                <Copy size={16} className="mr-2" />
                复制 Key
              </button>
            </div>
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
