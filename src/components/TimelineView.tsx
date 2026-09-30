import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Globe,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Calendar as CalendarIcon,
  Tag,
  User,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RedmineIssue, RedmineProject, RedmineStatus, RedmineTracker, RedminePriority, RedmineUser } from '../types/redmine';
import type { PersonalTask } from '../types/personalTask';
import {
  TimelineItem,
  generateTimelineDays,
  packTimelineLanes,
  convertIssuesToTimelineItems,
  convertPersonalTasksToTimelineItems,
  formatViDate,
  toDateString,
} from '../services/timelineHelper';
import { getSavedTasks, saveTasks, getUserScopeKey } from '../services/personalTaskStorage';
import { getStoredConfig } from '../services/redmineApi';

interface TimelineViewProps {
  issues: RedmineIssue[];
  statuses: RedmineStatus[];
  trackers: RedmineTracker[];
  priorities: RedminePriority[];
  projects: RedmineProject[];
  selectedProjectId: string;
  currentUser: RedmineUser | null;
  onSelectIssue?: (issue: RedmineIssue) => void;
  onSelectPersonalTask?: (task: PersonalTask) => void;
  onOpenCreateIssue?: () => void;
  onOpenCreatePersonalTask?: () => void;
  onRefreshRedmine?: () => void;
  isRedmineLoading?: boolean;
}

type TimelineSource = 'personal' | 'redmine';
type ZoomMode = 'day' | 'week';

export const TimelineView: React.FC<TimelineViewProps> = ({
  issues,
  statuses,
  trackers,
  priorities,
  projects,
  selectedProjectId,
  currentUser,
  onSelectIssue,
  onSelectPersonalTask,
  onOpenCreateIssue,
  onOpenCreatePersonalTask,
  onRefreshRedmine,
  isRedmineLoading = false,
}) => {
  // Active data source
  const [source, setSource] = useState<TimelineSource>('redmine');
  const [zoom, setZoom] = useState<ZoomMode>('day');
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTracker, setSelectedTracker] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Timeline center date (defaults to today)
  const [centerDate, setCenterDate] = useState<Date>(() => new Date());

  // Personal tasks from local storage
  const currentApiKey = useMemo(() => getStoredConfig().apiKey, []);
  const userScopeKey = useMemo(
    () => getUserScopeKey(currentUser, currentApiKey),
    [currentUser, currentApiKey]
  );
  const currentUserName = currentUser
    ? `${currentUser.firstname} ${currentUser.lastname}`.trim() || currentUser.login
    : '';

  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(() =>
    getSavedTasks(userScopeKey, currentUserName).filter((t) => t.source !== 'redmine')
  );

  // Reload personal tasks on user change
  useEffect(() => {
    setPersonalTasks(getSavedTasks(userScopeKey, currentUserName).filter((t) => t.source !== 'redmine'));
  }, [userScopeKey, currentUserName]);

  // Today string
  const todayStr = useMemo(() => toDateString(new Date()), []);

  // Convert raw items into normalized timeline items
  const { scheduledItems, unscheduledItems } = useMemo(() => {
    if (source === 'redmine') {
      return convertIssuesToTimelineItems(issues, todayStr);
    } else {
      return convertPersonalTasksToTimelineItems(personalTasks, todayStr);
    }
  }, [source, issues, personalTasks, todayStr]);

  // Dynamic filter options based on current items
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    [...scheduledItems, ...unscheduledItems].forEach((i) => {
      if (i.statusName) set.add(i.statusName);
    });
    return Array.from(set).sort();
  }, [scheduledItems, unscheduledItems]);

  const availableTrackers = useMemo(() => {
    const set = new Set<string>();
    [...scheduledItems, ...unscheduledItems].forEach((i) => {
      const tag = i.trackerName || i.category;
      if (tag) set.add(tag);
    });
    return Array.from(set).sort();
  }, [scheduledItems, unscheduledItems]);

  const availableAssignees = useMemo(() => {
    const set = new Set<string>();
    [...scheduledItems, ...unscheduledItems].forEach((i) => {
      if (i.assigneeName) set.add(i.assigneeName);
    });
    return Array.from(set).sort();
  }, [scheduledItems, unscheduledItems]);

  // Filtered scheduled items
  const filteredScheduledItems = useMemo(() => {
    return scheduledItems.filter((item) => {
      if (selectedStatus !== 'all' && item.statusName !== selectedStatus) return false;
      const tag = item.trackerName || item.category;
      if (selectedTracker !== 'all' && tag !== selectedTracker) return false;
      if (selectedAssignee !== 'all' && item.assigneeName !== selectedAssignee) return false;

      if (search) {
        const q = search.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inAssignee = item.assigneeName?.toLowerCase().includes(q);
        const inTag = tag?.toLowerCase().includes(q);
        const inProject = item.projectName?.toLowerCase().includes(q);
        if (!inTitle && !inAssignee && !inTag && !inProject) return false;
      }
      return true;
    });
  }, [scheduledItems, selectedStatus, selectedTracker, selectedAssignee, search]);

  // Timeline calendar grid config
  const colWidth = zoom === 'day' ? 52 : 36;
  const daysBefore = zoom === 'day' ? 12 : 21;
  const daysAfter = zoom === 'day' ? 38 : 70;

  const { days } = useMemo(
    () => generateTimelineDays(centerDate, daysBefore, daysAfter),
    [centerDate, daysBefore, daysAfter]
  );

  // Pack items into lanes
  const { placedItems, totalLanes } = useMemo(
    () => packTimelineLanes(filteredScheduledItems, days, colWidth),
    [filteredScheduledItems, days, colWidth]
  );

  // Group days by month for the top month header
  const monthGroups = useMemo(() => {
    const groups: { monthName: string; year: number; startIndex: number; count: number }[] = [];
    let currentGroup: { monthName: string; year: number; startIndex: number; count: number } | null = null;

    days.forEach((day, index) => {
      if (!currentGroup || currentGroup.monthName !== day.monthName || currentGroup.year !== day.year) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          monthName: day.monthName,
          year: day.year,
          startIndex: index,
          count: 1,
        };
      } else {
        currentGroup.count += 1;
      }
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [days]);

  // Find index of Today
  const todayIndex = useMemo(() => {
    return days.findIndex((d) => d.isToday);
  }, [days]);

  // Horizontal scroll container ref
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to center / today on load or navigation
  const scrollToToday = () => {
    if (timelineScrollRef.current && todayIndex !== -1) {
      const scrollPos = Math.max(0, todayIndex * colWidth - 250);
      timelineScrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (timelineScrollRef.current && todayIndex !== -1) {
      const scrollPos = Math.max(0, todayIndex * colWidth - 250);
      timelineScrollRef.current.scrollLeft = scrollPos;
    }
  }, [centerDate, zoom, todayIndex, colWidth]);

  // Navigate dates
  const handlePrev = () => {
    setCenterDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - (zoom === 'day' ? 20 : 35));
      return next;
    });
  };

  const handleNext = () => {
    setCenterDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + (zoom === 'day' ? 20 : 35));
      return next;
    });
  };

  const handleToday = () => {
    setCenterDate(new Date());
  };

  // Status badge styling helper
  const getStatusBadgeClass = (statusName: string) => {
    const s = statusName.toLowerCase();
    if (s.includes('done') || s.includes('closed') || s.includes('đã đóng') || s.includes('hoàn thành')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (s.includes('in progress') || s.includes('đang làm') || s.includes('tiến hành')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (s.includes('feedback') || s.includes('review') || s.includes('chờ duyệt')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (s.includes('reject') || s.includes('failed') || s.includes('lỗi')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const laneHeight = 52;
  const canvasHeight = Math.max(totalLanes * laneHeight + 20, 280);

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shadow-xs flex-shrink-0">
            <CalendarRange className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">Lịch trình & Kế hoạch tiến độ (Timeline)</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                Gantt Plan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi trực quan thời gian bắt đầu và kết thúc của các công việc cá nhân hoặc toàn dự án
            </p>
          </div>
        </div>

        {/* Source Switcher: Personal vs Project */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => {
                setSource('personal');
                setSelectedStatus('all');
                setSelectedTracker('all');
                setSelectedAssignee('all');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                source === 'personal'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Kế hoạch cá nhân</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                {personalTasks.length}
              </span>
            </button>

            <button
              onClick={() => {
                setSource('redmine');
                setSelectedStatus('all');
                setSelectedTracker('all');
                setSelectedAssignee('all');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                source === 'redmine'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dự án Redmine</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                {issues.length}
              </span>
            </button>
          </div>

          {/* Quick Create Button */}
          {source === 'personal' ? (
            <button
              onClick={onOpenCreatePersonalTask}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm việc cá nhân</span>
            </button>
          ) : (
            <button
              onClick={onOpenCreateIssue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo việc Redmine</span>
            </button>
          )}

          {source === 'redmine' && onRefreshRedmine && (
            <button
              onClick={onRefreshRedmine}
              disabled={isRedmineLoading}
              title="Làm mới dữ liệu Redmine"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRedmineLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          )}
        </div>
      </section>

      {/* 2. Control Toolbar & Timeline Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Timeline Navigation (< Today >) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
            <button
              onClick={handlePrev}
              title="Lùi thời gian"
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 text-slate-700 border-x border-slate-200 transition-colors cursor-pointer"
            >
              Hôm nay
            </button>
            <button
              onClick={handleNext}
              title="Tiến thời gian"
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current period indicator */}
          <div className="font-semibold text-slate-800 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
            {monthGroups.map((g) => `${g.monthName}/${g.year}`).join(' — ')}
          </div>

          {/* Zoom toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setZoom('day')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                zoom === 'day' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ngày
            </button>
            <button
              onClick={() => setZoom('week')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                zoom === 'week' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tuần
            </button>
          </div>
        </div>

        {/* Right: Search & Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên việc, người làm…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
            />
          </div>

          {/* Status filter */}
          {availableStatuses.length > 0 && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium"
            >
              <option value="all">Tất cả trạng thái</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Tracker/Category filter */}
          {availableTrackers.length > 0 && (
            <select
              value={selectedTracker}
              onChange={(e) => setSelectedTracker(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium"
            >
              <option value="all">Tất cả {source === 'redmine' ? 'Tracker' : 'Nhóm việc'}</option>
              {availableTrackers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* Assignee filter */}
          {availableAssignees.length > 0 && (
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium"
            >
              <option value="all">Tất cả thành viên</option>
              {availableAssignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}

          {/* Unscheduled items toggle */}
          {unscheduledItems.length > 0 && (
            <button
              onClick={() => setShowUnscheduled(!showUnscheduled)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showUnscheduled
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Chưa xếp lịch ({unscheduledItems.length})</span>
              {showUnscheduled ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 3. Unscheduled Items Panel (if toggled) */}
      {showUnscheduled && unscheduledItems.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-xs text-amber-900 uppercase tracking-wider">
                Công việc chưa có Ngày bắt đầu hoặc Hạn chót ({unscheduledItems.length})
              </span>
            </div>
            <span className="text-[11px] text-amber-700">
              Nhấp vào công việc để mở thông tin và gán ngày xếp lịch
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {unscheduledItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.source === 'redmine' && item.rawIssue && onSelectIssue) {
                    onSelectIssue(item.rawIssue);
                  } else if (item.source === 'personal' && item.rawPersonalTask && onSelectPersonalTask) {
                    onSelectPersonalTask(item.rawPersonalTask);
                  }
                }}
                className="bg-white p-2.5 rounded-lg border border-amber-200 hover:border-amber-400 hover:shadow-2xs transition-all cursor-pointer text-xs"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-slate-800 truncate" title={item.title}>
                    {item.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${getStatusBadgeClass(item.statusName)}`}>
                    {item.statusName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{item.assigneeName || 'Chưa phân công'}</span>
                  <span className="text-amber-600 font-medium">Chưa có ngày ⚠️</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Timeline Notion-Style Canvas */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Scrollable Container */}
        <div
          ref={timelineScrollRef}
          className="overflow-x-auto overflow-y-hidden select-none relative"
          style={{ maxHeight: '72vh' }}
        >
          <div style={{ width: `${days.length * colWidth}px`, minWidth: '100%' }}>
            {/* Top Month Grouping Header */}
            <div className="flex border-b border-slate-200 bg-slate-50/90 text-slate-700 text-xs font-bold sticky top-0 z-20">
              {monthGroups.map((group, idx) => (
                <div
                  key={`${group.monthName}-${group.year}-${idx}`}
                  style={{ width: `${group.count * colWidth}px` }}
                  className="px-3 py-1.5 border-r border-slate-200 text-left truncate flex items-center gap-1.5"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 inline flex-shrink-0" />
                  <span>{group.monthName} năm {group.year}</span>
                </div>
              ))}
            </div>

            {/* Days Header */}
            <div className="flex border-b border-slate-200 bg-white sticky top-[33px] z-20">
              {days.map((day, idx) => {
                return (
                  <div
                    key={day.dateStr}
                    style={{ width: `${colWidth}px` }}
                    className={`text-center py-1.5 border-r border-slate-100 flex flex-col justify-between text-[11px] ${
                      day.isWeekend ? 'bg-slate-50/60 text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-tight">{day.dayOfWeekName}</span>
                    <div className="my-0.5">
                      {day.isToday ? (
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[11px] shadow-xs mx-auto">
                          {day.dayNumber}
                        </span>
                      ) : (
                        <span className="font-semibold">{day.dayNumber}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Canvas Body: Lanes & Vertical Grid Lines */}
            <div className="relative" style={{ height: `${canvasHeight}px` }}>
              {/* Vertical Day Lines Background */}
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map((day) => (
                  <div
                    key={`grid-${day.dateStr}`}
                    style={{ width: `${colWidth}px` }}
                    className={`border-r border-slate-100 h-full ${
                      day.isWeekend ? 'bg-slate-50/30' : ''
                    }`}
                  />
                ))}
              </div>

              {/* Vertical Today Line Indicator (Full Height) */}
              {todayIndex !== -1 && (
                <div
                  style={{
                    left: `${todayIndex * colWidth + Math.floor(colWidth / 2)}px`,
                  }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none"
                >
                  <div className="w-2 h-2 -ml-[3px] rounded-full bg-rose-500 shadow-2xs" />
                </div>
              )}

              {/* Empty state if no tasks on timeline */}
              {placedItems.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <CalendarRange className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">Không có công việc nào trong khoảng thời gian này</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {unscheduledItems.length > 0
                      ? `Có ${unscheduledItems.length} công việc chưa xếp lịch ở góc trên.`
                      : 'Hãy thêm công việc mới hoặc chuyển đổi nguồn dữ liệu.'}
                  </p>
                </div>
              )}

              {/* Task Cards placed in Lanes */}
              {placedItems.map((placed) => {
                const item = placed.item;
                const topPx = placed.laneIndex * laneHeight + 10;
                const tag = item.trackerName || item.category;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.source === 'redmine' && item.rawIssue && onSelectIssue) {
                        onSelectIssue(item.rawIssue);
                      } else if (item.source === 'personal' && item.rawPersonalTask && onSelectPersonalTask) {
                        onSelectPersonalTask(item.rawPersonalTask);
                      }
                    }}
                    style={{
                      left: `${placed.leftPx}px`,
                      width: `${placed.widthPx}px`,
                      top: `${topPx}px`,
                    }}
                    className={`group absolute h-[38px] bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-lg shadow-2xs transition-all cursor-pointer flex items-center px-2.5 gap-2 overflow-hidden z-15 ${
                      item.hasFallbackDate ? 'border-dashed border-amber-300' : ''
                    }`}
                    title={`${item.title}\nThời gian: ${formatViDate(item.startDate)} - ${formatViDate(item.dueDate)}\nTrạng thái: ${item.statusName}\nNgười làm: ${item.assigneeName || 'Chưa gán'}`}
                  >
                    {/* Status badge pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${getStatusBadgeClass(
                        item.statusName
                      )}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{item.statusName}</span>
                    </span>

                    {/* Tracker/Category pill */}
                    {tag && (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 flex-shrink-0 border border-slate-200">
                        {tag}
                      </span>
                    )}

                    {/* Task Title */}
                    <span className="font-semibold text-xs text-slate-800 truncate flex-1 min-w-[60px]">
                      {item.title}
                    </span>

                    {/* Date label right side */}
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 hidden md:inline">
                      {formatViDate(item.startDate)} - {formatViDate(item.dueDate)}
                    </span>

                    {/* Done Ratio progress bar at card bottom */}
                    {item.doneRatio > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${item.doneRatio}%` }}
                          className="h-full bg-emerald-500 transition-all"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              Đang hiển thị: <strong className="text-slate-800">{placedItems.length}</strong> công việc trên lịch
            </span>
            {unscheduledItems.length > 0 && (
              <span className="text-amber-700">
                ⚠️ <strong className="font-semibold">{unscheduledItems.length}</strong> việc chưa xếp ngày
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Hôm nay ({todayStr})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded border border-dashed border-amber-400 bg-amber-50" />
              <span>Việc chỉ có 1 ngày</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
