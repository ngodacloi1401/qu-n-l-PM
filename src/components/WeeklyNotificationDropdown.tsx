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
  Settings,
  CalendarPlus,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { PersonalTask } from '../types/personalTask';
import type { RedmineIssue, RedmineUser } from '../types/redmine';
import {
  computeWeeklyNotifications,
  type WeeklyNotificationItem,
} from '../services/weeklyNotificationService';
import {
  getStoredSlackToken,
  getStoredSlackMemberId,
  getAuthToken,
} from '../services/redmineApi';
import {
  getSlackHandledMap,
  toggleSlackItemDone,
  setSlackItemStatus,
  type SlackActionStatus,
} from '../services/slackActionService';

export interface SlackAlertItem {
  id: string;
  channelId: string;
  channelName: string;
  senderName: string;
  senderId?: string;
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
  onConvertSlackToTask?: (alert: SlackAlertItem) => void;
  onOpenSettings?: () => void;
}

export const WeeklyNotificationDropdown: React.FC<WeeklyNotificationDropdownProps> = ({
  personalTasks,
  redmineIssues,
  currentUser,
  onSelectIssue,
  onSelectPersonalTask,
  onConvertSlackToTask,
  onOpenSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'today_overdue' | 'slack_alerts' | 'dueSoon' | 'all'>('today_overdue');
  const [slackAlerts, setSlackAlerts] = useState<SlackAlertItem[]>([]);
  const [isLoadingSlack, setIsLoadingSlack] = useState(false);
  const [slackFilterMode, setSlackFilterMode] = useState<'pending' | 'done' | 'all'>('pending');
  const [handledMap, setHandledMap] = useState<Record<string, SlackActionStatus>>(() =>
    getSlackHandledMap(currentUser?.id)
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasPersonalSlack = Boolean(getStoredSlackToken() || getStoredSlackMemberId());

  // Đồng bộ lại handledMap khi đổi tài khoản
  useEffect(() => {
    setHandledMap(getSlackHandledMap(currentUser?.id));
  }, [currentUser?.id]);

  // Tải danh sách thông báo Slack từ dữ liệu đồng bộ
  const loadSlackAlerts = async () => {
    try {
      setIsLoadingSlack(true);
      const headers: Record<string, string> = {};
      const slackToken = getStoredSlackToken();
      const slackMemberId = getStoredSlackMemberId();
      if (slackToken) headers['x-slack-token'] = slackToken;
      if (slackMemberId) headers['x-slack-user-id'] = slackMemberId;
      if (currentUser?.login) headers['x-user-name'] = currentUser.login;
      const authToken = getAuthToken();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/notifications/alerts?t=' + Date.now(), { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSlackAlerts(data);
          return;
        }
      }

      // Fallback nếu api trả về lỗi
      const fallbackRes = await fetch('/data/slack_alerts.json?t=' + Date.now());
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData)) {
          setSlackAlerts(fallbackData);
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
  }, [currentUser?.id, currentUser?.login]);

  // Compute summary reactively cho công việc Redmine & cá nhân
  const summary = useMemo(() => {
    return computeWeeklyNotifications({
      personalTasks,
      redmineIssues,
      currentUserId: currentUser?.id,
    });
  }, [personalTasks, redmineIssues, currentUser?.id]);

  // Chỉ đếm các thông báo khẩn/họp CHƯA hoàn thành
  const urgentSlackCount = useMemo(() => {
    return slackAlerts.filter(
      (a) => (a.urgency === 'Cao' || Boolean(a.meetUrl)) && handledMap[a.id] !== 'done'
    ).length;
  }, [slackAlerts, handledMap]);

  // Tổng số tin nhắn Slack chưa xử lý
  const pendingSlackCount = useMemo(() => {
    return slackAlerts.filter((a) => handledMap[a.id] !== 'done').length;
  }, [slackAlerts, handledMap]);

  const doneSlackCount = useMemo(() => {
    return slackAlerts.filter((a) => handledMap[a.id] === 'done').length;
  }, [slackAlerts, handledMap]);

  // Danh sách Slack được lọc theo trạng thái (Cần làm / Đã xong / Tất cả)
  const displayedSlackAlerts = useMemo(() => {
    switch (slackFilterMode) {
      case 'pending':
        return slackAlerts.filter((a) => handledMap[a.id] !== 'done');
      case 'done':
        return slackAlerts.filter((a) => handledMap[a.id] === 'done');
      default:
        return slackAlerts;
    }
  }, [slackAlerts, handledMap, slackFilterMode]);

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
        return summary.thisWeek;
      default:
        return todayAndOverdueItems;
    }
  }, [activeTab, todayAndOverdueItems, summary.dueTomorrow, summary.thisWeek]);

  const handleTaskClick = (item: WeeklyNotificationItem) => {
    setIsOpen(false);
    if (item.source === 'redmine' && onSelectIssue && item.rawRedmineIssue) {
      onSelectIssue(item.rawRedmineIssue);
    } else if (item.source === 'personal' && onSelectPersonalTask && item.rawPersonalTask) {
      onSelectPersonalTask(item.rawPersonalTask);
    }
  };

  const handleToggleSlackDone = (alertId: string) => {
    const updated = toggleSlackItemDone(alertId, currentUser?.id);
    setHandledMap(updated);
  };

  const handleCreateTaskFromSlack = (alert: SlackAlertItem) => {
    if (onConvertSlackToTask) {
      // Đánh dấu alert này là in_progress hoặc done
      const updated = setSlackItemStatus(alert.id, 'done', currentUser?.id);
      setHandledMap(updated);
      onConvertSlackToTask(alert);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="btn-weekly-notifications"
        onClick={() => setIsOpen(!isOpen)}
        title="Thông báo tuần & lịch họp Slack"
        className={`relative p-2 rounded-lg border transition-all cursor-pointer ${
          totalActionRequired > 0
            ? 'bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100 hover:border-rose-400'
            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        {totalActionRequired > 0 ? (
          <BellRing className="w-4 h-4 animate-bounce text-rose-600" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {totalActionRequired > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4.5 h-4.5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs ring-2 ring-white">
            {totalActionRequired > 99 ? '99+' : totalActionRequired}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <span>Trung tâm Thông báo</span>
                  {summary.overdue.length > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {summary.overdue.length} trễ
                    </span>
                  )}
                  {urgentSlackCount > 0 && (
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {urgentSlackCount} Slack/họp
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-300">
                  {summary.currentWeekLabel} &bull; Redmine &amp; Slack
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadSlackAlerts}
                title="Tải lại thông báo Slack"
                className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSlack ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200 text-center py-2 px-1 text-xs divide-x divide-slate-200">
            <div>
              <div className="text-[10px] text-slate-500">Quá hạn</div>
              <div className={`font-bold ${summary.overdue.length > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {summary.overdue.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Hôm nay</div>
              <div className={`font-bold ${summary.dueToday.length > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                {summary.dueToday.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Slack cần làm</div>
              <div className={`font-bold ${pendingSlackCount > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                {pendingSlackCount}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Tổng tuần</div>
              <div className="font-bold text-slate-800">{summary.thisWeek.length}</div>
            </div>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 text-xs overflow-x-auto no-scrollbar">
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
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
                activeTab === 'slack_alerts'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3 h-3 text-indigo-300" />
              <span>Slack &amp; Lịch họp</span>
              {hasPersonalSlack && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Đã kết nối Slack cá nhân" />
              )}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'slack_alerts' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-800 font-bold'
              }`}>
                {pendingSlackCount}
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
              <>
                {/* Status subheader banner & filter pills */}
                <div className="p-2 bg-slate-50 border-b border-slate-100 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      {hasPersonalSlack ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium text-emerald-800">Đã kích hoạt lọc Slack cá nhân</span>
                        </>
                      ) : (
                        <>
                          <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                          <span>Nguồn chung AnyBIM</span>
                        </>
                      )}
                    </div>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => { setIsOpen(false); onOpenSettings(); }}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        {hasPersonalSlack ? 'Đổi cấu hình' : 'Kết nối Slack riêng'}
                      </button>
                    )}
                  </div>

                  {/* Slack Handling Filter Pills */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400 text-[10px] font-medium mr-1">Bộ lọc:</span>
                    <button
                      type="button"
                      onClick={() => setSlackFilterMode('pending')}
                      className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                        slackFilterMode === 'pending'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Cần xử lý ({pendingSlackCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlackFilterMode('done')}
                      className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                        slackFilterMode === 'done'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Đã xử lý ({doneSlackCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlackFilterMode('all')}
                      className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                        slackFilterMode === 'all'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Tất cả ({slackAlerts.length})
                    </button>
                  </div>
                </div>

                {/* Danh sách Thông báo Slack & Lịch họp */}
                {displayedSlackAlerts.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {slackFilterMode === 'done'
                        ? 'Chưa có thông báo Slack nào được đánh dấu hoàn thành.'
                        : 'Tuyệt vời! Không còn deadline hoặc yêu cầu Slack nào cần xử lý.'}
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      {slackFilterMode === 'done'
                        ? 'Bạn có thể bấm "Xong" trên các tin nhắn đang chờ để lưu vào đây.'
                        : 'Mọi thông báo khẩn và cuộc họp đã được giải quyết hoặc chuyển thành công việc cá nhân.'}
                    </p>
                  </div>
                ) : (
                  displayedSlackAlerts.map((alert) => {
                    const isDone = handledMap[alert.id] === 'done';
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 transition-colors hover:bg-slate-50 flex flex-col gap-1.5 border-l-3 ${
                          isDone
                            ? 'bg-slate-50/70 border-slate-300 opacity-75'
                            : alert.urgency === 'Cao' || Boolean(alert.meetUrl)
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
                                isDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : alert.urgency === 'Cao'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isDone ? 'Đã xong' : alert.urgency}
                            </span>
                            <span className="text-[10px] text-slate-500">{alert.timeStr}</span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 truncate max-w-[120px]">
                            từ <strong>{alert.senderName}</strong>
                          </span>
                        </div>

                        <div className={`text-xs font-bold ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'} line-clamp-2`}>
                          {alert.title}
                        </div>

                        <div className="text-[11px] text-slate-600 line-clamp-3 bg-white/80 p-2 rounded-lg border border-slate-200/80 whitespace-pre-line">
                          {alert.summary}
                        </div>

                        {/* Action Links & Deadline Management Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {/* Toggle Done Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleSlackDone(alert.id)}
                              title={isDone ? 'Đánh dấu chưa xử lý (Hoàn tác)' : 'Đánh dấu đã xử lý xong yêu cầu này'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                                isDone
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-slate-100 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-700 hover:text-emerald-700'
                              }`}
                            >
                              {isDone ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Đã xử lý</span>
                                  <RotateCcw className="w-3 h-3 text-slate-400 ml-0.5" />
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Xong</span>
                                </>
                              )}
                            </button>

                            {/* Convert to Personal Task Button */}
                            {onConvertSlackToTask && (
                              <button
                                type="button"
                                onClick={() => handleCreateTaskFromSlack(alert)}
                                title="Đưa yêu cầu này thành một thẻ việc trên Bảng Việc Cá Nhân"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <CalendarPlus className="w-3.5 h-3.5 text-indigo-600" />
                                <span>+ Việc cá nhân</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {alert.meetUrl && (
                              <a
                                href={alert.meetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Vào Meet</span>
                              </a>
                            )}
                            <a
                              href={alert.slackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Mở Slack</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
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
