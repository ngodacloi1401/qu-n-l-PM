import type { PersonalTask } from '../types/personalTask';

const STORAGE_KEY_PREFIX = 'personal_tasks_data_v2';

/**
 * Generate a short, stable hash string from a string.
 */
function hashKey(str: string): string {
  if (!str) return 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Build a user-scoped key based on Redmine user ID, login, or API key.
 * This guarantees complete data isolation between different Redmine accounts.
 */
export function getUserScopeKey(
  currentUser?: { id?: number; login?: string; firstname?: string; lastname?: string } | null,
  apiKey?: string
): string {
  if (currentUser?.id) {
    return `${STORAGE_KEY_PREFIX}_uid_${currentUser.id}`;
  }
  if (currentUser?.login) {
    return `${STORAGE_KEY_PREFIX}_login_${currentUser.login.toLowerCase()}`;
  }
  const key = apiKey || (() => {
    try {
      return localStorage.getItem('redmine_pm_api_key') || '';
    } catch {
      return '';
    }
  })();
  if (key) {
    return `${STORAGE_KEY_PREFIX}_key_${hashKey(key)}`;
  }
  return `${STORAGE_KEY_PREFIX}_default`;
}

/**
 * Default empty task list (no fake mock data).
 */
export function getInitialSampleTasks(_userName?: string): PersonalTask[] {
  return [];
}

export const INITIAL_SAMPLE_TASKS: PersonalTask[] = [];

/**
 * Migrate data from old non-user-scoped key if it was user-created.
 */
function migrateOldData(newKey: string): PersonalTask[] | null {
  try {
    const oldKey = STORAGE_KEY_PREFIX;
    const oldData = localStorage.getItem(oldKey);
    if (oldData) {
      const parsed = JSON.parse(oldData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out old sample mock tasks
        const userCreated = parsed.filter(
          (t: PersonalTask) => !t.id?.startsWith('sample_task_')
        );
        if (userCreated.length > 0) {
          localStorage.setItem(newKey, JSON.stringify(userCreated));
          localStorage.removeItem(oldKey);
          return userCreated;
        }
      }
      localStorage.removeItem(oldKey);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Get saved personal tasks for the current Redmine user.
 * @param scopeKey - The user scope key from getUserScopeKey() or an API key string
 * @param _userName - Optional display name of user
 */
export function getSavedTasks(scopeKey?: string, _userName?: string): PersonalTask[] {
  try {
    const key = scopeKey && scopeKey.startsWith(STORAGE_KEY_PREFIX)
      ? scopeKey
      : getUserScopeKey(null, scopeKey);

    const raw = localStorage.getItem(key);
    if (!raw) {
      const migrated = migrateOldData(key);
      if (migrated) return migrated;
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out any legacy mock tasks that might be lingering
    return parsed.filter((t: PersonalTask) => !t.id?.startsWith('sample_task_'));
  } catch (err) {
    console.error('Failed to load personal tasks from localStorage', err);
    return [];
  }
}

/**
 * Save personal tasks for the current Redmine user.
 * @param tasks - The tasks array to persist.
 * @param scopeKey - The user scope key from getUserScopeKey() or an API key string
 */
export function saveTasks(tasks: PersonalTask[], scopeKey?: string): void {
  try {
    const key = scopeKey && scopeKey.startsWith(STORAGE_KEY_PREFIX)
      ? scopeKey
      : getUserScopeKey(null, scopeKey);

    // Filter out any legacy mock tasks before saving
    const cleanTasks = tasks.filter((t) => !t.id?.startsWith('sample_task_'));
    localStorage.setItem(key, JSON.stringify(cleanTasks));
  } catch (err) {
    console.error('Failed to save personal tasks to localStorage', err);
  }
}
