import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let cachedApiKey: string | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export interface RedmineServerConfig {
  baseUrl: string;
  apiKey: string;
  source: 'header' | 'env' | 'windows-credential' | 'config-file' | 'fallback';
}

/**
 * Resolves Redmine API Key securely with prioritized fallbacks:
 * 1. Explicit request header (x-redmine-api-key)
 * 2. Process environment (REDMINE_API_KEY)
 * 3. Windows Credential Manager (via redmine-auth.ps1 -Action GetKey)
 * 4. Workspace redmine_config.json
 */
export function resolveRedmineCredentials(customUrl?: string, customKey?: string): RedmineServerConfig {
  const baseUrl = (customUrl?.trim() || process.env.REDMINE_URL || 'https://redmine.anybim.vn').replace(/\/+$/, '');

  // 1. Explicit header passed by caller
  if (customKey && customKey.trim().length > 0) {
    return { baseUrl, apiKey: customKey.trim(), source: 'header' };
  }

  // 2. Environment variable
  if (process.env.REDMINE_API_KEY && process.env.REDMINE_API_KEY.trim().length > 0) {
    return { baseUrl, apiKey: process.env.REDMINE_API_KEY.trim(), source: 'env' };
  }

  // 3. Cached Windows Credential
  const now = Date.now();
  if (cachedApiKey && now - lastCheckTime < CACHE_TTL_MS) {
    return { baseUrl, apiKey: cachedApiKey, source: 'windows-credential' };
  }

  // Check Windows Credential Manager via redmine-auth.ps1 if on Windows
  if (process.platform === 'win32') {
    const candidateScriptPaths = [
      path.resolve(process.cwd(), '..', 'redmine-auth.ps1'),
      path.resolve(process.cwd(), 'redmine-auth.ps1'),
      'd:\\app\\redmine-auth.ps1',
    ];

    for (const scriptPath of candidateScriptPaths) {
      if (fs.existsSync(scriptPath)) {
        try {
          const raw = execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Action GetKey`, {
            encoding: 'utf-8',
            timeout: 5000,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          const key = (raw || '').trim();
          if (key && !key.toLowerCase().includes('error') && key.length >= 20) {
            cachedApiKey = key;
            lastCheckTime = now;
            return { baseUrl, apiKey: key, source: 'windows-credential' };
          }
        } catch {
          // ignore and check next
        }
      }
    }
  }

  // 4. redmine_config.json fallback
  const candidateConfigPaths = [
    path.resolve(process.cwd(), '..', 'redmine_config.json'),
    path.resolve(process.cwd(), 'redmine_config.json'),
    'd:\\app\\redmine_config.json',
  ];

  for (const cfgPath of candidateConfigPaths) {
    if (fs.existsSync(cfgPath)) {
      try {
        const rawJson = fs.readFileSync(cfgPath, 'utf-8');
        const parsed = JSON.parse(rawJson);
        if (parsed.apiKey && typeof parsed.apiKey === 'string' && parsed.apiKey.trim().length > 0) {
          return { baseUrl: (parsed.baseUrl || baseUrl).replace(/\/+$/, ''), apiKey: parsed.apiKey.trim(), source: 'config-file' };
        }
      } catch {
        // ignore
      }
    }
  }

  return { baseUrl, apiKey: '', source: 'fallback' };
}
