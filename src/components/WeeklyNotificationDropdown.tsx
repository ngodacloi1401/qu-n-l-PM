import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Clock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Flame,
  Video,
  MessageSquare,
  ExternalLink,
  Radio,
  RefreshCw,
  MonitorCheck,
} from 'lucide-react';
import type { PersonalTask } from '../types/personalTask';
import type { RedmineIssue, RedmineUser } from '../types/redmine';
import {
  computeWeeklyNotifications,
  type WeeklyNotificationItem,
} from '../services/weeklyNotificationService';

export interface SlackAlertItem {
  id: string;
  channelId: string;
  channelName: string;
  senderName: string;
  title: string;
  summary: string;
  cleanText: string;
  ts: string;
  timeStr: string;
  urgency: 'Cao' | 'Trung bình' | 'Thấp';
  category: string;
  reason?: string;
  meetUrl?: string | null;
  slackUrl: string;
}

interface WeeklyNotificationDropdownProps {
  personalTasks: PersonalTask[];
  redmineIssues: RedmineIssue[];
  currentUser?: RedmineUser | null;
  onSelectIssue?: (issue: RedmineIssue) => void;
  onSelectPersonalTask?: (task: PersonalTask) => void;
}

export const WeeklyNotificationDropdown: React.FC<WeeklyNotificationDropdownProps> = ({
  personalTasks,
  redmineIssues,
  currentUser,
  onSelectIssue,
  onSelectPersonalTask,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'today_overdue' | 'slack_alerts' | 'dueSoon' | 'all'>('today_overdue');
  const [slackAlerts, setSlackAlerts] = useState<SlackAlertItem[]>([]);
  const [isLoadingSlack, setIsLoadingSlack] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tải danh sách thông báo Slack từ dữ liệu đồng bộ
  const loadSlackAlerts = async () => {
    try {
      setIsLoadingSlack(true);
      const res = await fetch('/data/slack_alerts.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSlackAlerts(data);
        }
      }
    } catch (e) {
      console.warn('Không thể nạp thông báo Slack:', e);
    } finally {
      setIsLoadingSlack(false);
    }
  };

  useEffect(() => {
    loadSlackAlerts();
  }, []);

  // Compute summary reactively cho công việc Redmine & cá nhân
  const summary = useMemo(() => {
    return computeWeeklyNotifications({
      personalTasks,
      redmineIssues,
      currentUserId: currentUser?.id,
    });
  }, [personalTasks, redmineIssues, currentUser?.id]);

  const urgentSlackCount = useMemo(() => {
    return slackAlerts.filter((a) => a.urgency === 'Cao' || Boolean(a.meetUrl)).length;
  }, [slackAlerts]);

  const totalActionRequired = summary.totalActionRequired + urgentSlackCount;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const todayAndOverdueItems = useMemo(() => {
    const seen = new Set<string>();
    const list: WeeklyNotificationItem[] = [];
    for (const item of summary.overdue) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    }
    for (const item of summary.dueToday) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    }
    return list;
  }, [summary.overdue, summary.dueToday]);

  const displayTasks = useMemo(() => {
    switch (activeTab) {
      case 'today_overdue':
        return todayAndOverdueItems;
      case 'dueSoon':
        return summary.dueTomorrow;
      case 'all':
      default:
        return summary.thisWeek;
    }
  }, [activeTab, todayAndOverdueItems, summary.dueTomorrow, summary.thisWeek]);

  const handleTaskClick = (item: WeeklyNotificationItem) => {
    setIsOpen(false);
    if (item.source === 'personal' && item.rawPersonalTask && onSelectPersonalTask) {
      onSelectPersonalTask(item.rawPersonalTask);
    } else if (item.source === 'redmine' && item.rawRedmineIssue && onSelectIssue) {
      onSelectIssue(item.rawRedmineIssue);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
        title="Trung tâm Thông báo & Công việc tuần"
        aria-label="Trung tâm Thông báo & Công việc tuần"
      >
        <Bell className="w-5 h-5" />

        {totalActionRequired > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
              {totalActionRequired > 99 ? '99+' : totalActionRequired}
            </span>
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 rounded-full bg-rose-400 opacity-75 animate-ping" />
          </>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-88 sm:w-104 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wide uppercase text-emerald-400">
                  {summary.currentWeekLabel}
                </span>
                {urgentSlackCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-600 text-white flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    {urgentSlackCount} họp/khẩn
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <BellRing className="w-4 h-4 text-amber-400" />
                Thông báo &amp; Lịch công việc
              </h4>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadSlackAlerts}
                title="Tải lại thông báo Slack"
                className="p-1.5 rounded-lg text-xs font-medium bg-white/10 text-slate-300 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSlack ? 'animate-spin text-emerald-400' : ''}`} />
              </button>

              {/* Desktop Notification Active Indicator */}
              <div
                className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 flex items-center gap-1"
                title="Thông báo tự động đẩy trực tiếp ra Windows Desktop Notification (không qua Chrome)"
              >
                <MonitorCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] hidden sm:inline font-semibold">
                  Desktop Alert
                </span>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-xs overflow-x-auto">
            {/* Tab: Hôm nay & Quá hạn */}
            <button
              type="button"
              onClick={() => setActiveTab('today_overdue')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'today_overdue'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-300" />
              <span>Việc cần làm</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {todayAndOverdueItems.length}
              </span>
            </button>

            {/* Tab: Thông báo Slack & Lịch họp */}
            <button
              type="button"
              onClick={() => setActiveTab('slack_alerts')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'slack_alerts'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3 h-3 text-indigo-300" />
              <span>Slack &amp; Lịch họp</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'slack_alerts' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-800 font-bold'
              }`}>
                {slackAlerts.length}
              </span>
            </button>

            {/* Tab: Ngày mai */}
            <button
              type="button"
              onClick={() => setActiveTab('dueSoon')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'dueSoon'
                  ? 'bg-amber-100 text-amber-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Ngày mai</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/60 text-amber-950">
                {summary.dueTomorrow.length}
              </span>
            </button>

            {/* Tab: Tất cả tuần */}
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Tất cả tuần</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-300 text-slate-800">
                {summary.thisWeek.length}
              </span>
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-96">
            {activeTab === 'slack_alerts' ? (
              /* Danh sách Thông báo Slack & Lịch họp */
              slackAlerts.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Chưa có thông báo Slack mới!
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Các thông báo lịch học BA, seminar, link Google Meet và tin nhắn khẩn sẽ hiển thị tại đây khi hệ thống Watcher quét thấy.
                  </p>
                </div>
              ) : (
                slackAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 transition-colors hover:bg-slate-50 flex flex-col gap-1.5 border-l-3 ${
                      alert.urgency === 'Cao' || Boolean(alert.meetUrl)
                        ? 'bg-rose-50/25 border-rose-500'
                        : 'bg-indigo-50/15 border-indigo-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-indigo-100 text-indigo-800">
                          {alert.channelName}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            alert.urgency === 'Cao'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {alert.urgency}
                        </span>
                        <span className="text-[10px] text-slate-500">{alert.timeStr}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 truncate max-w-[120px]">
                        từ <strong>{alert.senderName}</strong>
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 line-clamp-2">
                      {alert.title}
                    </div>

                    <div className="text-[11px] text-slate-600 line-clamp-3 bg-white/80 p-2 rounded-lg border border-slate-200/80 whitespace-pre-line">
                      {alert.summary}
                    </div>

                    {/* Action Links */}
                    <div className="flex items-center gap-2 pt-1">
                      {alert.meetUrl && (
                        <a
                          href={alert.meetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Vào Google Meet</span>
                        </a>
                      )}
                      <a
                        href={alert.slackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở Slack</span>
                      </a>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Danh sách Công việc Redmine / Cá nhân */
              displayTasks.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Không có công việc nào trong mục này!
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {activeTab === 'today_overdue'
                      ? 'Tuyệt vời! Bạn không có việc nào quá hạn hoặc cần hoàn thành gấp hôm nay.'
                      : 'Toàn bộ công việc trong tuần đang diễn ra đúng tiến độ.'}
                  </p>
                </div>
              ) : (
                displayTasks.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleTaskClick(item)}
                    className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 group flex items-start gap-2.5 ${
                      item.isOverdue
                        ? 'bg-rose-50/40 border-l-3 border-rose-500'
                        : item.isDueToday
                        ? 'bg-amber-50/30 border-l-3 border-amber-500'
                        : 'border-l-3 border-transparent'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {item.isOverdue ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                      ) : item.isDueToday ? (
                        <Clock className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Calendar className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            item.source === 'redmine'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.source === 'redmine' ? 'Redmine' : 'Cá nhân'}
                        </span>
                        {item.categoryOrProject && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {item.categoryOrProject}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {item.title}
                      </div>

                      {/* Deadline date & status */}
                      <div className="flex items-center justify-between text-[11px] mt-1.5">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-slate-700">
                            {item.dayLabel} lúc {item.dueTimeFormatted}
                          </span>
                          <span className="text-slate-400">&bull;</span>
                          <span
                            className={`font-semibold ${
                              item.isOverdue
                                ? 'text-rose-600'
                                : item.isDueToday
                                ? 'text-amber-700'
                                : 'text-emerald-600'
                            }`}
                          >
                            {item.timeRemainingLabel}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {item.statusName}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0 self-center" />
                  </div>
                ))
              )
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {totalActionRequired > 0
                ? `${totalActionRequired} thông báo &amp; việc cần xử lý`
                : 'Tiến độ tuần đang rất tốt'}
            </span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <MonitorCheck className="w-3.5 h-3.5" />
              Windows Desktop Alert trực tiếp
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
