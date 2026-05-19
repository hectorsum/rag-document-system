'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { DollarSign, MessageSquare, FileText, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { getAnalyticsCosts, getAnalyticsUsage } from '@/lib/api';

interface CostSummary {
  totalSpent: number;
  totalQueries: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageCostPerQuery: number;
  costByDay: { date: string; cost: number }[];
  mostExpensiveQuery: { sessionId: string | null; cost: number; date: string } | null;
}

interface UsageSummary {
  documentsUploaded: number;
  totalChatSessions: number;
  totalQueriesLast7Days: number;
  queriesPerDay: { date: string; count: number }[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon size={16} className="text-blue-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: costsData } = useQuery<CostSummary>({
    queryKey: ['analytics', 'costs'],
    queryFn: () => getAnalyticsCosts().then(r => r.data),
  });

  const { data: usageData } = useQuery<UsageSummary>({
    queryKey: ['analytics', 'usage'],
    queryFn: () => getAnalyticsUsage().then(r => r.data),
  });

  const chartData = (costsData?.costByDay ?? []).map(d => ({
    date: format(new Date(d.date), 'MMM d'),
    cost: Number(d.cost.toFixed(6)),
  }));

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Analytics</h1>
      <p className="text-gray-500 text-sm mb-6">Cost tracking and usage statistics.</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Spent"
          value={`$${(costsData?.totalSpent ?? 0).toFixed(4)}`}
          icon={DollarSign}
          sub="All time"
        />
        <StatCard
          label="Total Queries"
          value={String(costsData?.totalQueries ?? 0)}
          icon={MessageSquare}
          sub={`Avg $${(costsData?.averageCostPerQuery ?? 0).toFixed(6)} each`}
        />
        <StatCard
          label="Documents"
          value={String(usageData?.documentsUploaded ?? 0)}
          icon={FileText}
          sub="Uploaded"
        />
        <StatCard
          label="Queries (7d)"
          value={String(usageData?.totalQueriesLast7Days ?? 0)}
          icon={TrendingUp}
          sub="Last 7 days"
        />
      </div>

      {/* Cost chart */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Cost per Day (last 30 days)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => `$${Number(v).toFixed(4)}`}
              />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(6)}`, 'Cost']} />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
            No cost data yet — ask a question to see usage here.
          </div>
        )}
      </div>

      {/* Token breakdown */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Token Usage</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Input tokens</p>
            <p className="font-semibold">{(costsData?.totalInputTokens ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Output tokens</p>
            <p className="font-semibold">{(costsData?.totalOutputTokens ?? 0).toLocaleString()}</p>
          </div>
          {costsData?.mostExpensiveQuery && (
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-gray-500">Most expensive query</p>
              <p className="font-semibold">
                ${costsData.mostExpensiveQuery.cost.toFixed(6)} —{' '}
                {format(new Date(costsData.mostExpensiveQuery.date), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
