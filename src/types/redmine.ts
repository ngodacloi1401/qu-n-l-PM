export interface RedmineNamedEntity {
  id: number;
  name: string;
}

export interface RedmineUser {
  id: number;
  login?: string;
  firstname?: string;
  lastname?: string;
  mail?: string;
  admin?: boolean;
  name?: string;
  api_key?: string;
}

export interface RedmineProject {
  id: number;
  name: string;
  identifier: string;
  description?: string;
  status?: number;
  created_on?: string;
  updated_on?: string;
}

export interface RedmineTracker {
  id: number;
  name: string;
  description?: string;
  default_status?: RedmineNamedEntity;
}

export interface RedmineStatus {
  id: number;
  name: string;
  is_closed: boolean;
}

export interface RedminePriority {
  id: number;
  name: string;
  is_default?: boolean;
}

export interface RedmineMembership {
  id: number;
  project: RedmineNamedEntity;
  user?: RedmineNamedEntity;
  roles: { id: number; name: string }[];
}

export interface RedmineVersion {
  id: number;
  project: RedmineNamedEntity;
  name: string;
  description?: string;
  status: 'open' | 'locked' | 'closed';
  due_date?: string;
}

export interface RedmineJournalDetail {
  property: string;
  name: string;
  old_value?: string;
  new_value?: string;
}

export interface RedmineJournal {
  id: number;
  user: RedmineNamedEntity;
  notes?: string;
  created_on: string;
  private_notes?: boolean;
  details?: RedmineJournalDetail[];
}

export interface RedmineIssue {
  id: number;
  project: RedmineNamedEntity;
  tracker: RedmineNamedEntity;
  status: RedmineNamedEntity;
  priority: RedmineNamedEntity;
  author: RedmineNamedEntity;
  assigned_to?: RedmineNamedEntity;
  fixed_version?: RedmineNamedEntity;
  subject: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  done_ratio: number;
  is_private?: boolean;
  estimated_hours?: number;
  spent_hours?: number;
  created_on: string;
  updated_on: string;
  closed_on?: string;
  journals?: RedmineJournal[];
  children?: { id: number; tracker: RedmineNamedEntity; subject: string }[];
}

export interface RedmineTimeEntry {
  id: number;
  project: RedmineNamedEntity;
  issue?: { id: number };
  user: RedmineNamedEntity;
  activity: RedmineNamedEntity;
  hours: number;
  comments?: string;
  spent_on: string;
  created_on: string;
  updated_on: string;
}

export interface RedmineConfig {
  baseUrl: string;
  apiKey: string;
}

export type ViewMode = 'kanban' | 'list' | 'analytics' | 'time' | 'ai';
