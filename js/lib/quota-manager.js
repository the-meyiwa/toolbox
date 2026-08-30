/* ============================================================
   TOOLBOX — Quota & Rate Limiting Engine
   Enforces user quotas:
   - 25 messages per user / day
   - Burst rate: 5 messages / minute
   - Max output: 2000 tokens / request
   - Heavy tool/agent tasks: 5 / day
   - Large file analysis: 3 / day
   ============================================================ */

import { getCurrentUser } from './supabase.js';

const STORAGE_QUOTA_KEY = 'toolbox_usage_quota_v1';

const LIMITS = {
  DAILY_MESSAGES: 25,
  BURST_PER_MINUTE: 5,
  MAX_OUTPUT_TOKENS: 2000,
  HEAVY_TASKS_DAILY: 5,
  LARGE_FILES_DAILY: 3
};

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function loadUsageState() {
  const today = getTodayString();
  let state = {};
  try {
    state = JSON.parse(localStorage.getItem(STORAGE_QUOTA_KEY) || '{}');
  } catch {}

  if (state.date !== today) {
    state = {
      date: today,
      messageCount: 0,
      recentMessageTimestamps: [],
      heavyTaskCount: 0,
      largeFileCount: 0
    };
    saveUsageState(state);
  }

  // Filter timestamps to last 60 seconds
  const now = Date.now();
  state.recentMessageTimestamps = (state.recentMessageTimestamps || []).filter(ts => now - ts < 60000);
  return state;
}

function saveUsageState(state) {
  try {
    localStorage.setItem(STORAGE_QUOTA_KEY, JSON.stringify(state));
  } catch {}
}

export const QuotaManager = {
  LIMITS,

  /**
   * Check if user can send a message
   */
  canSendMessage() {
    const usage = loadUsageState();

    if (usage.messageCount >= LIMITS.DAILY_MESSAGES) {
      return {
        allowed: false,
        reason: `Daily quota exceeded (${LIMITS.DAILY_MESSAGES}/${LIMITS.DAILY_MESSAGES} messages). Quota resets at midnight.`
      };
    }

    if (usage.recentMessageTimestamps.length >= LIMITS.BURST_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Burst rate limit exceeded (maximum ${LIMITS.BURST_PER_MINUTE} messages per minute). Please wait a moment.`
      };
    }

    return { allowed: true, remaining: LIMITS.DAILY_MESSAGES - usage.messageCount };
  },

  /**
   * Record a sent message
   */
  recordMessage() {
    const usage = loadUsageState();
    usage.messageCount++;
    usage.recentMessageTimestamps.push(Date.now());
    saveUsageState(usage);
    return usage.messageCount;
  },

  /**
   * Check if user can execute a heavy tool/agent task
   */
  canRunHeavyTask() {
    const usage = loadUsageState();
    if (usage.heavyTaskCount >= LIMITS.HEAVY_TASKS_DAILY) {
      return {
        allowed: false,
        reason: `Daily heavy task limit reached (${LIMITS.HEAVY_TASKS_DAILY}/${LIMITS.HEAVY_TASKS_DAILY} tasks today).`
      };
    }
    return { allowed: true, remaining: LIMITS.HEAVY_TASKS_DAILY - usage.heavyTaskCount };
  },

  /**
   * Record a heavy tool execution
   */
  recordHeavyTask() {
    const usage = loadUsageState();
    usage.heavyTaskCount++;
    saveUsageState(usage);
    return usage.heavyTaskCount;
  },

  /**
   * Check if user can analyze a large file
   */
  canAnalyzeLargeFile() {
    const usage = loadUsageState();
    if (usage.largeFileCount >= LIMITS.LARGE_FILES_DAILY) {
      return {
        allowed: false,
        reason: `Daily large file analysis limit reached (${LIMITS.LARGE_FILES_DAILY}/${LIMITS.LARGE_FILES_DAILY} files today).`
      };
    }
    return { allowed: true, remaining: LIMITS.LARGE_FILES_DAILY - usage.largeFileCount };
  },

  /**
   * Record a large file analysis
   */
  recordLargeFile() {
    const usage = loadUsageState();
    usage.largeFileCount++;
    saveUsageState(usage);
    return usage.largeFileCount;
  },

  /**
   * Get quota summary object for UI display
   */
  getQuotaSummary() {
    const usage = loadUsageState();
    return {
      messagesUsed: usage.messageCount,
      messagesLimit: LIMITS.DAILY_MESSAGES,
      messagesRemaining: Math.max(0, LIMITS.DAILY_MESSAGES - usage.messageCount),
      burstLimit: LIMITS.BURST_PER_MINUTE,
      maxOutputTokens: LIMITS.MAX_OUTPUT_TOKENS,
      heavyTasksUsed: usage.heavyTaskCount,
      heavyTasksLimit: LIMITS.HEAVY_TASKS_DAILY,
      largeFilesUsed: usage.largeFileCount,
      largeFilesLimit: LIMITS.LARGE_FILES_DAILY
    };
  }
};
