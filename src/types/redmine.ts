export interface RedmineNamedEntity {
  id: number;
  name: string;
}

export interface RedmineCustomField {
  id: number;
  name: string;
  customized_type?: string;
  field_format?: string;
  regexp?: string;
  min_length?: number;
  max_length?: number;
  is_required?: boolean;
  is_filter?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  default_value?: any;
  visible?: boolean;
  possible_values?: { value: string; label?: string }[] | string[];
  trackers?: RedmineNamedEntity[];
  roles?: RedmineNamedEntity[];
}

export interface RedmineIssueCategory {
  id: number;
  name: string;
  project?: RedmineNamedEntity;
  assigned_to?: RedmineNamedEntity;
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
  trackers?: RedmineNamedEntity[];
  issue_categories?: RedmineNamedEntity[];
  created_on?: string;
  updated_on?: string;
}

export interface RedmineTracker {
  id: number;
  name: string;
  description?: string;
  default_status?: RedmineNamedEntity;
  enabled_standard_fields?: string[];
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

export interface RedmineIssueCustomFieldValue {
  id: number;
  name: string;
  value: any;
  multiple?: boolean;
}

export interface RedmineIssue {
  id: number;
  project: RedmineNamedEntity;
  tracker: RedmineNamedEntity;
  status: RedmineNamedEntity;
  priority: RedmineNamedEntity;
  author: RedmineNamedEntity;
  assigned_to?: RedmineNamedEntity;
  category?: RedmineNamedEntity;
  fixed_version?: RedmineNamedEntity;
  parent?: { id: number };
  subject: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  done_ratio: number;
  is_private?: boolean;
  estimated_hours?: number;
  spent_hours?: number;
  custom_fields?: RedmineIssueCustomFieldValue[];
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

export type ViewMode = 'kanban' | 'list' | 'analytics' | 'time' | 'ot' | 'ai' | 'personal';

export type TimePeriodType =
  | 'all'
  | 'this_month'
  | 'last_month'
  | 'specific_month'
  | 'this_week'
  | 'last_week'
  | 'today'
  | 'custom';

export type DateFieldType = 'created_on' | 'updated_on' | 'due_date';

