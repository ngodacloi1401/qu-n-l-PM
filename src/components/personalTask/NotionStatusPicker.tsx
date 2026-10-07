import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import type { RedmineStatus } from '../../types/redmine';

// ────────────────────────────────────────────────────────────────────────────
// Notion-style status groups with Vietnamese labels
// ────────────────────────────────────────────────────────────────────────────

export interface StatusGroupConfig {
  groupKey: 'todo' | 'in_progress' | 'complete';
  label: string;
  /** CSS classes for the colour dot */
  dotClass: string;
  matchKeywords: string[];
}

const STATUS_GROUPS: StatusGroupConfig[] = [
  {
    groupKey: 'todo',
    label: 'Việc cần làm',
    dotClass: 'bg-slate-400',
    matchKeywords: ['new', 'not started', 'mới', 'chưa làm', 'to do', 'open'],
  },
  {
    groupKey: 'in_progress',
    label: 'Đang thực hiện',
    dotClass: 'bg-blue-500',
    matchKeywords: [
      'in progress', 'đang làm', 'doing', 'pending', 'on stg',
      'qa testing', 'ready for qa', 'qa verified', 'feedback',
      'review', 'kiểm tra',
    ],
  },
  {
    groupKey: 'complete',
    label: 'Hoàn tất',
    dotClass: 'bg-emerald-500',
    matchKeywords: [
      'closed', 'resolved', 'done', 'hoàn thành', 'close-duplicated',
      'on prod', 'client verified', 'cancelled', 'rejected',
    ],
  },
];

/**
 * Resolve the dot colour class for a given status name.
 * Certain status names get special colours (e.g. Cancelled → red, Pending → yellow).
 */
export function getStatusDotClass(statusName: string): string {
  const s = (statusName || '').toLowerCase().trim();
  // Specific overrides matching the Notion screenshot
  if (s === 'cancelled' || s === 'rejected' || s.includes('cancel')) return 'bg-rose-500';
  if (s === 'pending' || s.includes('feedback') || s.includes('chờ')) return 'bg-amber-400';
  if (s === 'in progress' || s === 'đang làm' || s === 'doing') return 'bg-blue-500';
  if (s === 'done' || s === 'closed' || s === 'resolved' || s.includes('hoàn thành')) return 'bg-emerald-500';
  if (s === 'qa testing' || s.includes('qa') || s.includes('review')) return 'bg-purple-500';
  if (s === 'on prod' || s.includes('prod') || s.includes('stg')) return 'bg-cyan-500';
  if (s === 'not started' || s === 'new' || s.includes('mới')) return 'bg-slate-400';
  // Fallback: grey
  return 'bg-slate-400';
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
  /** Compact mode – shows only the dot + short label (used inside table cells) */
  compact?: boolean;
  /** Disable interaction (read-only display) */
  disabled?: boolean;
}

const DEFAULT_STATUS_NAMES = [
  'Not started',
  'Pending',
  'In Progress',
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

    // Prefer to open downward
    const spaceBelow = viewportHeight - container.bottom;
    const spaceAbove = container.top;
    if (spaceBelow < 240 && spaceAbove > spaceBelow) {
      dd.style.bottom = `${container.height + 4}px`;
      dd.style.top = 'auto';
    } else {
      dd.style.top = `${container.height + 4}px`;
      dd.style.bottom = 'auto';
    }
  }, [open]);

  const dotClass = getStatusDotClass(value);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`
          inline-flex items-center gap-1.5 rounded-md transition-all cursor-pointer select-none
          ${compact
            ? 'px-2 py-1 text-[11px] font-bold hover:bg-slate-100 border border-transparent hover:border-slate-200'
            : 'px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-xs'
          }
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
          ${open ? 'bg-slate-50 border-slate-300 ring-2 ring-indigo-200' : 'bg-white'}
        `}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="truncate max-w-[140px]">{value || 'Chọn trạng thái'}</span>
        {!compact && <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {/* ── Dropdown Popup ── */}
      {open && (
        <div
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 z-[60] w-56 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ top: '100%', marginTop: 4 }}
        >
          <div className="max-h-72 overflow-y-auto py-1.5">
            {grouped.map((group) => (
              <div key={group.config.groupKey}>
                {/* Group Label */}
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                  {group.config.label}
                </div>
                {/* Status Items */}
                {group.items.map((name) => {
                  const isActive = name === value;
                  const itemDot = getStatusDotClass(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(name);
                        setOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer
                        ${isActive
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${itemDot} ${isActive ? 'ring-2 ring-indigo-300' : ''}`} />
                      <span className={`text-xs font-medium flex-1 truncate ${isActive ? 'font-bold' : ''}`}>{name}</span>
                      {isActive && (
                        <svg className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer — Edit properties link (non-functional visual fidelity) */}
          <div className="border-t border-slate-100 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium select-none">
              <Settings className="w-3 h-3" />
              Chỉnh sửa thuộc tính
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
