// Date utility functions using date-fns

import {
  format,
  formatDistance,
  formatRelative,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  endOfDay,
  isWithinInterval,
  isBefore,
  isAfter,
  parseISO,
} from 'date-fns';

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date to standard display format
 * @param date Date to format
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy');
}

/**
 * Format date to short display format
 * @param date Date to format
 * @returns Formatted date string (e.g., "Jan 15")
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd');
}

/**
 * Format date to day and date (e.g., "Mon 15")
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEE dd');
}

/**
 * Format date to ISO string for API calls
 * @param date Date to format
 * @returns ISO date string
 */
export function formatDateISO(date: Date): string {
  return date.toISOString();
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * @param date Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
}

/**
 * Format date and time
 * @param date Date to format
 * @returns Formatted date-time string (e.g., "Jan 15, 2024 at 2:30 PM")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy \'at\' h:mm a');
}

// ============================================================================
// Date Calculations
// ============================================================================

/**
 * Calculate the difference in days between two dates
 * @param start Start date
 * @param end End date
 * @returns Number of days
 */
export function getDaysDifference(start: Date, end: Date): number {
  return differenceInDays(end, start);
}

/**
 * Calculate the average of a list of numbers
 * @param numbers Array of numbers
 * @returns Average value
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

/**
 * Add days to a date
 * @param date Starting date
 * @param days Number of days to add
 * @returns New date
 */
export function addDaysToDate(date: Date, days: number): Date {
  return addDays(date, days);
}

/**
 * Check if a date is within a date range
 * @param date Date to check
 * @param start Range start
 * @param end Range end
 * @returns True if date is within range
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return isWithinInterval(date, { start, end });
}

// ============================================================================
// Gantt Chart Utilities
// ============================================================================

/**
 * Convert a date to a percentage position on a timeline
 * @param date Date to convert
 * @param rangeStart Timeline start date
 * @param rangeEnd Timeline end date
 * @returns Percentage (0-100)
 */
export function dateToPercentage(
  date: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const totalDays = differenceInDays(rangeEnd, rangeStart);
  if (totalDays === 0) return 0;

  const daysFromStart = differenceInDays(date, rangeStart);
  const percentage = (daysFromStart / totalDays) * 100;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, percentage));
}

/**
 * Convert a percentage position to a date on a timeline
 * @param percentage Percentage (0-100)
 * @param rangeStart Timeline start date
 * @param rangeEnd Timeline end date
 * @returns Calculated date
 */
export function percentageToDate(
  percentage: number,
  rangeStart: Date,
  rangeEnd: Date
): Date {
  const totalDays = differenceInDays(rangeEnd, rangeStart);
  const daysToAdd = Math.round((percentage / 100) * totalDays);
  return addDays(rangeStart, daysToAdd);
}

/**
 * Calculate task bar position and width for Gantt chart
 * @param taskStart Task start date
 * @param taskEnd Task end date
 * @param rangeStart Timeline start date
 * @param rangeEnd Timeline end date
 * @returns Object with left position and width percentages
 */
export function calculateTaskBar(
  taskStart: Date,
  taskEnd: Date,
  rangeStart: Date,
  rangeEnd: Date
): { left: number; width: number } {
  const left = dateToPercentage(taskStart, rangeStart, rangeEnd);
  const right = dateToPercentage(taskEnd, rangeStart, rangeEnd);
  const width = right - left;

  return {
    left: Math.max(0, left),
    width: Math.max(1, width), // Minimum width of 1%
  };
}

/**
 * Generate a date range for a Gantt chart view
 * @param centerDate Date to center the range around (default: today)
 * @param totalDays Total days to show (default: 30)
 * @returns Object with start and end dates
 */
export function generateDateRange(
  centerDate: Date = new Date(),
  totalDays: number = 30
): { start: Date; end: Date } {
  const halfDays = Math.floor(totalDays / 2);
  const start = addDays(startOfDay(centerDate), -halfDays);
  const end = addDays(endOfDay(centerDate), halfDays);

  return { start, end };
}

/**
 * Convert a pixel/percentage position back to a date on a timeline
 * (alias used by GanttChart for drag-to-resize)
 */
export function pixelToDate(
  percentage: number,
  rangeStart: Date,
  rangeEnd: Date
): Date {
  return percentageToDate(percentage, rangeStart, rangeEnd);
}

/**
 * Get month labels between two dates for Gantt chart header
 */
export function getMonthLabels(rangeStart: Date, rangeEnd: Date): string[] {
  const labels: string[] = [];
  let current = startOfMonth(rangeStart);

  while (isBefore(current, rangeEnd) || current.getTime() === rangeEnd.getTime()) {
    labels.push(format(current, 'MMM yyyy'));
    current = addMonths(current, 1);
  }

  return labels.length > 0 ? labels : [format(rangeStart, 'MMM yyyy')];
}

/**
 * Calculate the date range from a list of tasks (earliest start to latest end + buffer)
 */
export function getDateRange(tasks: { startDate: Date; endDate: Date }[]): {
  rangeStart: Date;
  rangeEnd: Date;
} {
  if (tasks.length === 0) {
    const now = new Date();
    return { rangeStart: addDays(now, -15), rangeEnd: addDays(now, 15) };
  }

  let earliest = tasks[0].startDate;
  let latest = tasks[0].endDate;

  for (const task of tasks) {
    if (isBefore(task.startDate, earliest)) earliest = task.startDate;
    if (isAfter(task.endDate, latest)) latest = task.endDate;
  }

  // Add 7-day buffer on each side
  return {
    rangeStart: addDays(startOfDay(earliest), -7),
    rangeEnd: addDays(endOfDay(latest), 7),
  };
}

// ============================================================================
// Time Display Utilities
// ============================================================================

/**
 * Format a timestamp as relative time with smart formatting
 * - Less than 1 hour: "X minutes ago"
 * - Less than 24 hours: "X hours ago"
 * - Less than 7 days: "X days ago"
 * - Older: Full date
 */
export function smartFormatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const minutes = differenceInMinutes(now, d);
  const hours = differenceInHours(now, d);
  const days = differenceInDays(now, d);

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes} min ago`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (days < 7) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    return formatDate(d);
  }
}

/**
 * Get the number of days until a deadline
 * @param deadline Deadline date
 * @returns Number of days (negative if past deadline)
 */
export function getDaysUntilDeadline(deadline: Date): number {
  return differenceInDays(deadline, new Date());
}

/**
 * Format deadline as "Due in X days" or "X days overdue"
 * @param deadline Deadline date
 * @returns Formatted deadline string
 */
export function formatDeadline(deadline: Date): string {
  const days = getDaysUntilDeadline(deadline);

  if (days < 0) {
    return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`;
  } else if (days === 0) {
    return 'Due today';
  } else if (days === 1) {
    return 'Due tomorrow';
  } else {
    return `Due in ${days} days`;
  }
}
