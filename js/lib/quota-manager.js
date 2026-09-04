/* ============================================================
   TOOLBOX — Quota & Rate Limiting Engine
   Enforces default usage guidelines for free tier, with automatic
   unlimited access for administrator and VIP accounts.
   ============================================================ */

const STORAGE_QUOTA_KEY = 'toolbox_usage_quota_v1';

export const UNLIMITED_ACCOUNTS = Object.freeze([
  'meyigbenee@gmail.com',
  'meyigbenee@icloud.com'
]);

const LIMITS = {
  DAILY_MESSAGES: 50,
  BURST_PER_MINUTE: 10,
  MAX_OUTPUT_TOKENS: 4000,
  HEAVY_TASKS_DAILY: 25,
  LARGE_FILES_DAILY: 20
};

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if the user is an authorized unlimited account
 * @param {string|null} [checkEmail] - Optional direct email string to verify
 */
export function isUserUnlimited(checkEmail = null) {
  try {
    if (checkEmail && typeof checkEmail === 'string') {
      const norm = checkEmail.toLowerCase().trim();
      return UNLIMITED_ACCOUNTS.includes(norm);
    }

    if (typeof localStorage === 'undefined') return false;

    // Check supabase session in localStorage
    const sessionKeys = [
      'toolbox_supabase_session',
      'supabase_auth_session',
      'sb-ssoruyruzbvgyondxlgj-auth-token'
    ];

    for (const key of sessionKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const email = (
            parsed.email ||
            parsed.user?.email ||
            parsed.currentSession?.user?.email ||
            ''
          ).toLowerCase().trim();
          if (email && UNLIMITED_ACCOUNTS.includes(email)) return true;
        } catch {}
      }
    }

    // Check SpaceEngine / user profile
    const profileKeys = [
      'toolbox_user_profile',
      'toolbox_user_email',
      'user_email',
      'toolbox_profile',
      'space_user_profile'
    ];

    for (const key of profileKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          if (raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            const email = (parsed.email || parsed.user_email || '').toLowerCase().trim();
            if (email && UNLIMITED_ACCOUNTS.includes(email)) return true;
          } else {
            const email = raw.toLowerCase().trim();
            if (email && UNLIMITED_ACCOUNTS.includes(email)) return true;
          }
        } catch {}
      }
    }
  } catch {}
  return false;
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
  UNLIMITED_ACCOUNTS,
  isUserUnlimited,

  /**
   * Reset all usage counters
   */
  resetQuotas() {
    if (!isUserUnlimited()) {
      throw new Error("Permission denied: Only unlimited accounts can reset quotas.");
    }
    const today = getTodayString();
    const cleanState = {
      date: today,
      messageCount: 0,
      recentMessageTimestamps: [],
      heavyTaskCount: 0,
      largeFileCount: 0
    };
    saveUsageState(cleanState);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:quotachange', { detail: cleanState }));
    }
    return cleanState;
  },

  /**
   * Check if user can send a message
   */
  canSendMessage() {
    if (isUserUnlimited()) {
      return { allowed: true, remaining: Infinity, isUnlimited: true };
    }

    const usage = loadUsageState();

    if (usage.messageCount >= LIMITS.DAILY_MESSAGES) {
      return {
        allowed: false,
        reason: `Daily free quota reached (${LIMITS.DAILY_MESSAGES}/${LIMITS.DAILY_MESSAGES} msgs). Reset quota to continue.`
      };
    }

    if (usage.recentMessageTimestamps.length >= LIMITS.BURST_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Burst rate limit reached (${LIMITS.BURST_PER_MINUTE} msgs/min). Please wait a few seconds.`
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:quotachange', { detail: usage }));
    }
    return usage.messageCount;
  },

  /**
   * Check if user can execute a heavy tool/agent task
   */
  canRunHeavyTask() {
    if (isUserUnlimited()) {
      return { allowed: true, remaining: Infinity, isUnlimited: true };
    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:quotachange', { detail: usage }));
    }
    return usage.heavyTaskCount;
  },

  /**
   * Check if user can analyze a large file
   */
  canAnalyzeLargeFile() {
    if (isUserUnlimited()) {
      return { allowed: true, remaining: Infinity, isUnlimited: true };
    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:quotachange', { detail: usage }));
    }
    return usage.largeFileCount;
  },

  /**
   * Get quota summary object for UI display
   */
  getQuotaSummary() {
    const unlimited = isUserUnlimited();
    const usage = loadUsageState();
    return {
      isUnlimited: unlimited,
      messagesUsed: usage.messageCount,
      messagesLimit: unlimited ? 'Unlimited' : LIMITS.DAILY_MESSAGES,
      messagesRemaining: unlimited ? 'Unlimited' : Math.max(0, LIMITS.DAILY_MESSAGES - usage.messageCount),
      burstLimit: unlimited ? 'Unlimited' : LIMITS.BURST_PER_MINUTE,
      maxOutputTokens: LIMITS.MAX_OUTPUT_TOKENS,
      heavyTasksUsed: usage.heavyTaskCount,
      heavyTasksLimit: unlimited ? 'Unlimited' : LIMITS.HEAVY_TASKS_DAILY,
      largeFilesUsed: usage.largeFileCount,
      largeFilesLimit: unlimited ? 'Unlimited' : LIMITS.LARGE_FILES_DAILY
    };
  }
};
