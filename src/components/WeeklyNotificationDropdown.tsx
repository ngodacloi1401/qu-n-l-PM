import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ChevronRight,
  ShieldAlert,
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
  const [activeTab, setActiveTab] = useState<'urgent' | 'overdue' | 'dueSoon' | 'all'>('urgent');
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

  // Trigger browser notification once per session if urgent items exist and permission is on
  const hasAlertedRef = useRef(false);
  useEffect(() => {
    if (browserNotifActive && summary.totalActionRequired > 0 && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      const title = `Bạn có ${summary.totalActionRequired} việc cần xử lý trong tuần!`;
      const body = `${summary.overdue.length} việc quá hạn, ${summary.dueSoon.length} việc sắp tới hạn. Nhấn để mở bảng quản lý.`;
      sendBrowserNotification(title, { body });
    }
  }, [browserNotifActive, summary.totalActionRequired, summary.overdue.length, summary.dueSoon.length]);

  const handleToggleBrowserNotif = async () => {
    if (!isBrowserNotificationSupported()) {
      alert('Trình duyệt của bạn không hỗ trợ tính năng thông báo Notification.');
      return;
    }

    if (browserNotifActive) {
      // User wants to disable
      setBrowserNotifActive(false);
    } else {
      const granted = await requestBrowserNotificationPermission();
      setBrowserNotifActive(granted);
      if (granted) {
        sendBrowserNotification('Đã bật thông báo công việc tuần!', {
          body: 'Hệ thống sẽ nhắc nhở bạn khi có công việc sắp tới hạn hoặc trễ hạn trong tuần.',
        });
      }
    }
  };

  const urgentItems = useMemo(() => {
    return [...summary.overdue, ...summary.dueSoon];
  }, [summary.overdue, summary.dueSoon]);

  const displayItems = useMemo(() => {
    switch (activeTab) {
      case 'overdue':
        return summary.overdue;
      case 'dueSoon':
        return summary.dueSoon;
      case 'all':
        return summary.thisWeek;
      case 'urgent':
      default:
        return urgentItems;
    }
  }, [activeTab, summary.overdue, summary.dueSoon, summary.thisWeek, urgentItems]);

  const handleItemClick = (item: WeeklyNotificationItem) => {
    setIsOpen(false);
    if (item.source === 'personal' && item.rawPersonalTask && onSelectPersonalTask) {
      onSelectPersonalTask(item.rawPersonalTask);
    } else if (item.source === 'redmine' && item.rawRedmineIssue && onSelectIssue) {
      onSelectIssue(item.rawRedmineIssue);
    }
  };

  const formatDueNotice = (item: WeeklyNotificationItem) => {
    if (!item.dueDate) return 'Không có deadline';
    const due = item.dueDate.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    if (item.isOverdue) {
      return (
        <span className="text-rose-600 font-semibold flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Quá hạn ({due})
        </span>
      );
    }
    if (due === today) {
      return (
        <span className="text-amber-600 font-bold flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Hạn chót hôm nay!
        </span>
      );
    }
    return (
      <span className="text-slate-500 flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        Hạn: {due}
      </span>
    );
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
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wide uppercase text-emerald-400">
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
              onClick={() => setActiveTab('urgent')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'urgent'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Cần xử lý</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {urgentItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overdue')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'overdue'
                  ? 'bg-rose-100 text-rose-800'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Quá hạn</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200/50">
                {summary.overdue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dueSoon')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                activeTab === 'dueSoon'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Sắp tới hạn</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/50">
                {summary.dueSoon.length}
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
              <span>Tất cả tuần</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-300">
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
                  {activeTab === 'urgent'
                    ? 'Tuyệt vời! Bạn không có việc nào quá hạn hoặc sắp hết hạn trong tuần.'
                    : 'Toàn bộ công việc đang diễn ra đúng tiến độ.'}
                </p>
              </div>
            ) : (
              displayItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 group flex items-start gap-2.5 ${
                    item.isOverdue ? 'bg-rose-50/30' : item.isDueSoon ? 'bg-amber-50/20' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item.isOverdue ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                    ) : item.isDueSoon ? (
                      <Clock className="w-4 h-4 text-amber-500" />
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

                    <div className="flex items-center justify-between text-[11px] mt-1.5">
                      <div className="text-[11px]">{formatDueNotice(item)}</div>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
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
                ? `${summary.totalActionRequired} việc cần hành động`
                : 'Tiến độ tuần đang rất tốt'}
            </span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Tự động cập nhật
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
