import { useState, useEffect, useCallback } from 'react';
import { saveToStorage, loadFromStorage } from '@/lib/storage';

/**
 * Hook to sync state with localStorage
 * @param key Storage key
 * @param initialValue Initial value if key doesn't exist
 * @returns Tuple of [value, setValue] similar to useState
 *
 * @example
 * const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', []);
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize state with value from localStorage or initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    return loadFromStorage<T>(key, initialValue);
  });

  // Update localStorage when state changes
  useEffect(() => {
    saveToStorage(key, storedValue);
  }, [key, storedValue]);

  // Wrapper for setState that handles function updates
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        return newValue;
      });
    },
    []
  );

  return [storedValue, setValue];
}
