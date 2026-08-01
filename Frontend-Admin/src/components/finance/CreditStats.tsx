'use client';

import React from 'react';
import { Coins, Wallet, TrendingUp, TrendingDown, Gift, Users, FileText } from 'lucide-react';
import StatCard from '@/components/admin/resource/StatCard';
import type { CreditStatisticsData } from '../AdminFinanceCenterTypes';

interface CreditStatsProps {
  stats: CreditStatisticsData | null;
}

const formatNumber = (value: number | undefined | null) =>
  (Number(value) || 0).toLocaleString();

const CreditStats: React.FC<CreditStatsProps> = ({ stats }) => {
  const summary = stats?.summary;
  const redemption = stats?.redemption;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      <StatCard
        title="积分账户数"
        value={formatNumber(summary?.total_accounts)}
        icon={Users}
        color="purple"
        description="已开通积分账户的用户"
      />
      <StatCard
        title="账户总余额"
        value={formatNumber(summary?.total_balance)}
        icon={Wallet}
        color="blue"
        description="全部用户可用积分之和"
      />
      <StatCard
        title="累计发放"
        value={formatNumber(summary?.total_issued)}
        icon={Gift}
        color="green"
        description="充值 + 兑换 + 调整发放"
      />
      <StatCard
        title="累计消费"
        value={formatNumber(summary?.total_spent)}
        icon={TrendingDown}
        color="red"
        description="生成扣费 + 退款"
      />
      <StatCard
        title={`近${stats?.period_days ?? 30}天发放`}
        value={formatNumber(summary?.period_issued)}
        icon={TrendingUp}
        color="green"
        description="周期内新增积分"
      />
      <StatCard
        title="兑换码"
        value={`${formatNumber(redemption?.total_codes)} / ${formatNumber(redemption?.active_codes)} 可用`}
        icon={Coins}
        color="yellow"
        description={`累计已用 ${formatNumber(redemption?.total_used)} 次`}
      />
      <StatCard
        title="流水总笔数"
        value={formatNumber(summary?.total_ledger_records)}
        icon={FileText}
        color="orange"
        description={`近${stats?.period_days ?? 30}天 ${formatNumber(summary?.period_ledger_records)} 笔`}
      />
    </section>
  );
};

export default CreditStats;
