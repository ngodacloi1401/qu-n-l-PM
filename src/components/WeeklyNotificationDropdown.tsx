import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import type { PersonalTask } from '../types/personalTask';
import type { RedmineIssue, RedmineUser } from '../types/redmine';
import {
  computeWeeklyNotifications,
  isBrowserNotificationSupported,
  isBrowserNotificationEnabled,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
  type WeeklyNotificationItem,
} from '../services/weeklyNotificationService';

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
  const [activeTab, setActiveTab] = useState<'today_overdue' | 'dueSoon' | 'all'>('today_overdue');
  const [browserNotifActive, setBrowserNotifActive] = useState(() => isBrowserNotificationEnabled());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Compute summary reactively
  const summary = useMemo(() => {
    return computeWeeklyNotifications({
      personalTasks,
      redmineIssues,
      currentUserId: currentUser?.id,
    });
  }, [personalTasks, redmineIssues, currentUser?.id]);

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

  // Trigger browser notification once per session when there are urgent tasks
  const hasAlertedRef = useRef(false);
  useEffect(() => {
    if (browserNotifActive && summary.totalActionRequired > 0 && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      const title = `${summary.currentWeekLabel}: ${summary.totalActionRequired} việc cần xử lý!`;
      const body = `${summary.dueToday.length} việc có hạn hôm nay, ${summary.overdue.length} việc quá hạn tuần này.`;
      sendBrowserNotification(title, { body });
    }
  }, [browserNotifActive, summary.totalActionRequired, summary.dueToday.length, summary.overdue.length, summary.currentWeekLabel]);

  const handleToggleBrowserNotif = async () => {
    if (!isBrowserNotificationSupported()) {
      alert('Trình duyệt của bạn không hỗ trợ tính năng thông báo Notification.');
      return;
    }

    if (browserNotifActive) {
      setBrowserNotifActive(false);
    } else {
      const granted = await requestBrowserNotificationPermission();
      setBrowserNotifActive(granted);
      if (granted) {
        sendBrowserNotification('Đã bật thông báo công việc tuần!', {
          body: `Hệ thống sẽ nhắc nhở theo giờ và ngày cụ thể cho ${summary.currentWeekLabel}.`,
        });
      }
    }
  };

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

  const displayItems = useMemo(() => {
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

  const handleItemClick = (item: WeeklyNotificationItem) => {
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
        title="Thông báo công việc tuần"
        aria-label="Thông báo công việc tuần"
      >
        <Bell className="w-5 h-5" />

        {summary.totalActionRequired > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
              {summary.totalActionRequired > 99 ? '99+' : summary.totalActionRequired}
            </span>
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 rounded-full bg-rose-400 opacity-75 animate-ping" />
          </>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-98 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wide uppercase text-emerald-400">
                  {summary.currentWeekLabel}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <BellRing className="w-4 h-4 text-amber-400" />
                Thông báo công việc tuần
              </h4>
            </div>

            {/* Browser notification toggle */}
            <button
              type="button"
              onClick={handleToggleBrowserNotif}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                browserNotifActive
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
              title={browserNotifActive ? 'Đang bật thông báo trình duyệt' : 'Bật thông báo trình duyệt'}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">
                {browserNotifActive ? 'Đã bật chuông' : 'Bật chuông web'}
              </span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-xs overflow-x-auto">
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
              <span>Hôm nay &amp; Quá hạn</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {todayAndOverdueItems.length}
              </span>
            </button>

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

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Tất cả tuần này</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-300 text-slate-800">
                {summary.thisWeek.length}
              </span>
            </button>
          </div>

          {/* List of Tasks */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-96">
            {displayItems.length === 0 ? (
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
              displayItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
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

                    {/* Deadline date, exact time & hourly countdown */}
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
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {summary.totalActionRequired > 0
                ? `${summary.totalActionRequired} việc cần hành động gấp`
                : 'Tiến độ tuần đang rất tốt'}
            </span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Cập nhật theo giờ thực
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
