// LocalStorage utilities for data persistence

const STORAGE_PREFIX = 'journi_';

/**
 * Save data to localStorage with JSON serialization
 * @param key Storage key (will be prefixed with 'journi_')
 * @param data Data to store
 */
export function saveToStorage<T>(key: string, data: T): void {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const serialized = JSON.stringify(data, dateReviver);
    localStorage.setItem(prefixedKey, serialized);
  } catch (error) {
    console.error(`Error saving to localStorage (key: ${key}):`, error);
  }
}

/**
 * Load data from localStorage with JSON deserialization
 * @param key Storage key (will be prefixed with 'journi_')
 * @param defaultValue Default value if key doesn't exist
 * @returns Stored data or default value
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const item = localStorage.getItem(prefixedKey);

    if (item === null) {
      return defaultValue;
    }

    return JSON.parse(item, dateReplacer) as T;
  } catch (error) {
    console.error(`Error loading from localStorage (key: ${key}):`, error);
    return defaultValue;
  }
}

/**
 * Remove data from localStorage
 * @param key Storage key (will be prefixed with 'journi_')
 */
export function clearStorage(key: string): void {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
  } catch (error) {
    console.error(`Error clearing localStorage (key: ${key}):`, error);
  }
}

/**
 * Clear all Journi-related data from localStorage
 */
export function clearAllStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all storage:', error);
  }
}

/**
 * Check if a key exists in localStorage
 * @param key Storage key (will be prefixed with 'journi_')
 * @returns True if key exists
 */
export function storageKeyExists(key: string): boolean {
  const prefixedKey = `${STORAGE_PREFIX}${key}`;
  return localStorage.getItem(prefixedKey) !== null;
}

// ============================================================================
// Date Serialization Helpers
// ============================================================================

/**
 * Custom reviver for JSON.stringify to handle Date objects
 */
function dateReviver(_key: string, value: any): any {
  if (value instanceof Date) {
    return {
      __type: 'Date',
      value: value.toISOString(),
    };
  }
  return value;
}

/**
 * Custom replacer for JSON.parse to reconstruct Date objects
 */
function dateReplacer(_key: string, value: any): any {
  if (value && typeof value === 'object' && value.__type === 'Date') {
    return new Date(value.value);
  }
  return value;
}

// ============================================================================
// Storage Keys (constants for type safety)
// ============================================================================

export const STORAGE_KEYS = {
  PROJECT: 'project',
  MANUSCRIPT: 'manuscript',
  JOURNALS: 'journals',
  SUBMISSIONS: 'submissions',
  THEME: 'theme',
  USER_PREFERENCES: 'user_preferences',
} as const;
