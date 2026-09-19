import React from 'react';
import { calculatePMAnalytics, isIssueClosed } from '../services/pmAnalytics';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Users,
  Target,
  BarChart2,
  PieChart as PieIcon,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  RedmineIssue,
  RedmineVersion,
  RedmineStatus,
} from '../types/redmine';

interface DashboardAnalyticsProps {
  issues: RedmineIssue[];
  versions: RedmineVersion[];
  statuses: RedmineStatus[];
  loadedCount: number;
  totalAvailable: number;
  onSelectIssue: (issue: RedmineIssue) => void;
}

const COLORS = [
  '#4f46e5', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#ef4444', // red
  '#64748b', // slate
];

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  issues,
  versions,
  statuses, loadedCount, totalAvailable,
  onSelectIssue,
}) => {
  const { total, closed, inProgress, overdueIssues, blockedIssues, completionRate, workload: workloadChartData } = calculatePMAnalytics(issues, statuses);
  const reportVersions = [...new Map([...versions, ...issues.flatMap(i => i.fixed_version ? [i.fixed_version] : [])].map(v => [v.id, v])).values()];

  // Status breakdown data for Pie Chart
  const statusMap = new Map<number, { id: number; name: string; value: number }>();
  issues.forEach((i) => {
    const row = statusMap.get(i.status.id) || { id: i.status.id, name: i.status.name || 'Unknown', value: 0 };
    row.value++;
    statusMap.set(i.status.id, row);
  });
  const statusChartData = [...statusMap.values()]
    .sort((a, b) => b.value - a.value);

  // Tracker breakdown
  const trackerMap: Record<string, number> = {};
  issues.forEach((i) => {
    const t = i.tracker?.name || 'Other';
    trackerMap[t] = (trackerMap[t] || 0) + 1;
  });
  const trackerChartData = Object.entries(trackerMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">Báo cáo dùng trạng thái thực từ Redmine cho dự án và bộ lọc đang chọn: {total} công việc hiển thị; đã tải {loadedCount}/{totalAvailable}. {loadedCount < totalAvailable ? "Dữ liệu vẫn đang được tải nên số liệu có thể tiếp tục thay đổi." : "Đã tải đủ dữ liệu của dự án."}</p>
      {/* 5 PM High-Level KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng công việc</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{total}</div>
          <div className="text-[11px] text-slate-500 mt-1">Công việc trong phạm vi đang xem</div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đang làm</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{inProgress}</div>
          <div className="text-[11px] text-slate-500 mt-1">Status Redmine = In Progress và chưa đóng</div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tỷ lệ đã đóng</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{completionRate}%</div>
          <div className="text-[11px] text-slate-500 mt-1">{closed} việc có status được Redmine đánh dấu Đã đóng</div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Quá hạn chót</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{overdueIssues.length}</div>
          <div className="text-[11px] text-rose-700/80 mt-1">Có hạn chót trước hôm nay và status Redmine chưa đóng</div>
        </div>

        {/* Blocked / Failed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bị chặn / Lỗi QA</span>
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-600">{blockedIssues.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Blocked hoặc Failed test</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-sm mb-2">Đối chiếu trạng thái Redmine</h3>
        <p className="text-xs text-slate-600 mb-3">“Đã xong” chỉ dựa trên cờ Đã đóng của Redmine. QA Verified vẫn được tính là đang mở nếu Redmine chưa đánh dấu đóng. “Đang làm” chỉ gồm In Progress; các trạng thái New, Resolved, QA testing… vẫn được trình bày riêng bên dưới.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{statusChartData.map(row => { const configured = statuses.find(s => s.id === row.id); return <div key={row.id} className="border border-slate-200 rounded-lg p-3 text-xs"><div className="font-semibold">{row.name}</div><div className="mt-1">{row.value} việc · {configured?.is_closed ? 'Đã đóng' : 'Đang mở'}</div></div>; })}</div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Distribution Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Phân bổ tải công việc theo thành viên (Top 10)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Số issue được giao; chưa phản ánh số giờ hoặc độ phức tạp công việc
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={workloadChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="total" name="Tổng công việc" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="inProgress" name="Đang làm" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                <Bar dataKey="completed" name="Đã xong" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-cyan-600" />
                Cơ cấu trạng thái công việc (Status Breakdown)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Tỉ lệ phân bổ các giai đoạn trong quy trình</p>
            </div>
          </div>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {statusChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tracker breakdown + Milestone sprint progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trackers Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-600" />
            Phân loại công việc (Trackers)
          </h3>
          <div className="space-y-3">
            {trackerChartData.map((t, idx) => {
              const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">{t.name}</span>
                    <span className="text-slate-500">
                      {t.count} việc ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestone / Sprint Progress */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            Tiến độ các Milestone / Sprints ({reportVersions.length})
          </h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {reportVersions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Chưa có milestone nào trong dự án này
              </div>
            ) : (
              reportVersions.map((ver) => {
                const verIssues = issues.filter((i) => i.fixed_version?.id === ver.id);
                const verClosed = verIssues.filter(i => isIssueClosed(i, statuses)).length;
                const pct = verIssues.length > 0 ? Math.round((verClosed / verIssues.length) * 100) : 0;

                return (
                  <div key={ver.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                      <span>{ver.name}</span>
                      <span className="text-slate-500 font-medium">
                        {verIssues.length ? `${verClosed} / ${verIssues.length} (${pct}%)` : "Chưa có công việc trong phạm vi đã tải"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-indigo-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Urgent Issues requiring PM attention */}
      {overdueIssues.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Công việc Quá hạn cần PM đôn đốc ({overdueIssues.length})
            </h3>
            <span className="text-xs text-rose-600 font-medium">Cần xử lý gấp</span>
          </div>

          <div className="divide-y divide-rose-100">
            {overdueIssues.slice(0, 5).map((iss) => (
              <div
                key={iss.id}
                onClick={() => onSelectIssue(iss)}
                className="py-2.5 flex items-center justify-between gap-4 hover:bg-rose-50/50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-xs text-rose-800">#{iss.id}</span>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">{iss.subject}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                  <span className="text-rose-600 font-bold">Hạn: {iss.due_date}</span>
                  <span className="text-slate-500">{iss.assigned_to?.name || 'Chưa gán'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
