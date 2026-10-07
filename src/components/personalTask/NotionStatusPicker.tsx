import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { RedmineStatus } from '../../types/redmine';

// ────────────────────────────────────────────────────────────────────────────
// Notion-style status groups with Vietnamese labels
// ────────────────────────────────────────────────────────────────────────────

export interface StatusGroupConfig {
  groupKey: 'todo' | 'in_progress' | 'complete';
  label: string;
  matchKeywords: string[];
}

const STATUS_GROUPS: StatusGroupConfig[] = [
  {
    groupKey: 'todo',
    label: 'Việc cần làm',
    matchKeywords: ['new', 'not started', 'mới', 'chưa làm', 'to do', 'open'],
  },
  {
    groupKey: 'in_progress',
    label: 'Đang thực hiện',
    matchKeywords: [
      'in progress', 'đang làm', 'doing', 'pending', 'on stg',
      'qa testing', 'ready for qa', 'qa verified', 'feedback',
      'review', 'kiểm tra',
    ],
  },
  {
    groupKey: 'complete',
    label: 'Hoàn tất',
    matchKeywords: [
      'closed', 'resolved', 'done', 'hoàn thành', 'close-duplicated',
      'on prod', 'client verified', 'cancelled', 'rejected', 'hủy',
    ],
  },
];

export interface NotionPillStyle {
  pillBg: string;
  pillHoverBg: string;
  pillText: string;
  dotBg: string;
}

/**
 * Resolve authentic Notion pastel pill colours based on status name.
 * Colors directly match the Notion status property screenshot:
 * - Cancelled: pastel pink bg + rose dot & text
 * - Pending / QA: pastel purple bg + purple dot & text
 * - In Progress: pastel sky/blue bg + blue dot & text
 * - Done / Closed: pastel green bg + emerald dot & text
 * - Not started / New: pastel stone gray bg + stone dot & text
 */
export function getNotionPillStyle(statusName: string): NotionPillStyle {
  const s = (statusName || '').toLowerCase().trim();

  // Cancelled / Rejected (Pastel pink/red)
  if (s === 'cancelled' || s === 'hủy' || s.includes('cancel') || s.includes('reject')) {
    return {
      pillBg: 'bg-rose-100',
      pillHoverBg: 'hover:bg-rose-200',
      pillText: 'text-rose-800',
      dotBg: 'bg-rose-500',
    };
  }

  // Pending / Feedback / QA (Pastel purple)
  if (s === 'pending' || s.includes('feedback') || s.includes('chờ') || s.includes('qa') || s.includes('review')) {
    return {
      pillBg: 'bg-purple-100',
      pillHoverBg: 'hover:bg-purple-200',
      pillText: 'text-purple-800',
      dotBg: 'bg-purple-500',
    };
  }

  // In Progress / Doing (Pastel sky/blue)
  if (s === 'in progress' || s === 'đang làm' || s === 'doing' || s.includes('progress') || s.includes('stg')) {
    return {
      pillBg: 'bg-sky-100',
      pillHoverBg: 'hover:bg-sky-200',
      pillText: 'text-sky-800',
      dotBg: 'bg-sky-500',
    };
  }

  // Done / Resolved / Closed (Pastel green)
  if (s === 'done' || s === 'closed' || s === 'resolved' || s.includes('hoàn thành') || s.includes('prod') || s.includes('client verified')) {
    return {
      pillBg: 'bg-emerald-100',
      pillHoverBg: 'hover:bg-emerald-200',
      pillText: 'text-emerald-800',
      dotBg: 'bg-emerald-600',
    };
  }

  // Not started / New / Mới (Pastel warm gray)
  return {
    pillBg: 'bg-stone-200/80',
    pillHoverBg: 'hover:bg-stone-300/80',
    pillText: 'text-stone-700',
    dotBg: 'bg-stone-500',
  };
}

/** Legacy helper for backward compatibility */
export function getStatusDotClass(statusName: string): string {
  return getNotionPillStyle(statusName).dotBg;
}

function getGroupForStatus(statusName: string): StatusGroupConfig {
  const s = (statusName || '').toLowerCase().trim();
  for (const group of STATUS_GROUPS) {
    if (group.matchKeywords.some((kw) => s.includes(kw))) return group;
  }
  return STATUS_GROUPS[0]; // default → todo
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface NotionStatusPickerProps {
  /** Current status name */
  value: string;
  /** Callback when the user picks a new status */
  onChange: (statusName: string) => void;
  /** Redmine statuses to populate the list (fallback to defaults) */
  statuses?: RedmineStatus[];
  /** Additional class names for the trigger button */
  className?: string;
  /** Compact mode (retains the rounded pill styling) */
  compact?: boolean;
  /** Disable interaction (read-only display) */
  disabled?: boolean;
}

const DEFAULT_STATUS_NAMES = [
  'Not started',
  'Pending',
  'In progress',
  'Cancelled',
  'Done',
];

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export const NotionStatusPicker: React.FC<NotionStatusPickerProps> = ({
  value,
  onChange,
  statuses,
  className = '',
  compact = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build the list of status names to show
  const statusNames = useMemo(() => {
    if (statuses && statuses.length > 0) return statuses.map((s) => s.name);
    return DEFAULT_STATUS_NAMES;
  }, [statuses]);

  // Group statuses into Notion-style categories
  const grouped = useMemo(() => {
    const groups: Record<string, { config: StatusGroupConfig; items: string[] }> = {};
    STATUS_GROUPS.forEach((g) => {
      groups[g.groupKey] = { config: g, items: [] };
    });

    statusNames.forEach((name) => {
      const g = getGroupForStatus(name);
      groups[g.groupKey].items.push(name);
    });

    // Ensure the current value appears somewhere even if it's not in the known list
    if (value && !statusNames.includes(value)) {
      const g = getGroupForStatus(value);
      groups[g.groupKey].items.push(value);
    }

    return STATUS_GROUPS.map((g) => groups[g.groupKey]).filter((g) => g.items.length > 0);
  }, [statusNames, value]);

  // Filter groups by search query
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase().trim();
    return grouped
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [grouped, searchQuery]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Position the dropdown to avoid viewport overflow
  useEffect(() => {
    if (!open || !dropdownRef.current || !containerRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const dd = dropdownRef.current;
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - container.bottom;
    const spaceAbove = container.top;
    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      dd.style.bottom = `${container.height + 4}px`;
      dd.style.top = 'auto';
    } else {
      dd.style.top = `${container.height + 4}px`;
      dd.style.bottom = 'auto';
    }
  }, [open]);

  const pillStyle = getNotionPillStyle(value);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* ── Trigger Button: Authentic Notion Pill Badge ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setOpen((prev) => !prev);
            setSearchQuery('');
          }
        }}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none transition-all cursor-pointer shadow-2xs
          ${pillStyle.pillBg} ${pillStyle.pillHoverBg} ${pillStyle.pillText}
          ${open ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
          ${disabled ? 'opacity-60 cursor-default' : ''}
        `}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pillStyle.dotBg}`} />
        <span className="truncate max-w-[130px]">{value || 'Not started'}</span>
      </button>

      {/* ── Dropdown Popup: Pixel-perfect to Notion Status Picker Screenshot ── */}
      {open && (
        <div
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 z-[80] w-60 bg-white rounded-xl border border-stone-200/90 shadow-2xl overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: '100%', marginTop: 4 }}
        >
          {/* Header with active pill & text search cursor like Notion */}
          <div className="px-2.5 pt-1.5 pb-2 border-b border-stone-100 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${pillStyle.pillBg} ${pillStyle.pillText}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${pillStyle.dotBg}`} />
              <span className="truncate max-w-[100px]">{value || 'Not started'}</span>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm hoặc đổi..."
              autoFocus
              className="flex-1 text-xs px-1 py-0.5 border-none outline-none text-stone-700 placeholder:text-stone-400 font-normal bg-transparent"
            />
          </div>

          {/* Groups list */}
          <div className="max-h-72 overflow-y-auto px-1 py-1 space-y-2">
            {filteredGrouped.map((group) => (
              <div key={group.config.groupKey}>
                {/* Group Label */}
                <div className="px-2.5 py-1 text-[11px] font-medium text-stone-500 select-none">
                  {group.config.label}
                </div>

                {/* Status Items as Notion Pills */}
                <div className="space-y-0.5">
                  {group.items.map((name) => {
                    const itemPill = getNotionPillStyle(name);
                    const isActive = name === value;

                    return (
                      <div
                        key={name}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange(name);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          isActive ? 'bg-stone-100/90' : 'hover:bg-stone-50'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${itemPill.pillBg} ${itemPill.pillText}`}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${itemPill.dotBg}`} />
                          <span className="truncate max-w-[150px]">{name}</span>
                        </span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredGrouped.length === 0 && (
              <div className="p-3 text-center text-xs text-stone-400">
                Không tìm thấy trạng thái phù hợp
              </div>
            )}
          </div>

          {/* Footer — Edit properties link */}
          <div className="border-t border-stone-200/70 pt-1.5 pb-0.5 px-2 mt-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg cursor-pointer select-none">
              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
              <span>Chỉnh sửa thuộc tính</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
