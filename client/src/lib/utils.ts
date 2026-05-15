import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the current Jerusalem timezone offset in hours (2 for winter/IST, 3 for summer/IDT)
 * This dynamically calculates the offset based on DST
 */
export function getJerusalemOffset(): number {
  const now = new Date();
  const jerusalemFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    hour12: false
  });
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    hour12: false
  });
  
  const jerusalemHour = parseInt(jerusalemFormatter.format(now));
  const utcHour = parseInt(utcFormatter.format(now));
  
  let offset = jerusalemHour - utcHour;
  if (offset < 0) offset += 24;
  if (offset > 12) offset -= 24;
  
  return offset;
}

/**
 * Format a date as YYYY-MM-DD string in Asia/Jerusalem timezone
 * This ensures dates are always formatted consistently regardless of client timezone
 * and prevents DST-related date shifts when working with date-only values
 */
export function formatJerusalemDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date formatted as YYYY-MM-DD in Asia/Jerusalem timezone
 */
export function getTodayJerusalem(): string {
  return formatJerusalemDate(new Date());
}

/**
 * Check if a given date is in the past (before today in Jerusalem timezone)
 */
export function isPastDate(date: Date): boolean {
  const todayJerusalem = getTodayJerusalem();
  const dateJerusalem = formatJerusalemDate(date);
  return dateJerusalem < todayJerusalem;
}

/**
 * Create a Date object from Jerusalem date string (YYYY-MM-DD) at Jerusalem noon
 * This prevents timezone-related day shifts when working with date-only values
 */
export function createJerusalemDate(dateString: string): Date {
  // Create date at Jerusalem noon to avoid day boundary issues
  return new Date(`${dateString}T12:00:00+03:00`);
}

/**
 * Add days to a Jerusalem date string and return the new Jerusalem date string
 */
export function addDaysToJerusalemDate(dateString: string, days: number): string {
  const date = createJerusalemDate(dateString);
  date.setDate(date.getDate() + days);
  return formatJerusalemDate(date);
}

/**
 * Extract date from a Date object without timezone shifts
 * This is useful for dates that represent calendar days (not moments in time)
 * and prevents date shifting when processing timestamps
 */
export function extractDateWithoutTimezoneShift(date: Date): string {
  // Get the local date components from the Date object
  // This prevents timezone conversion issues that can shift dates by one day
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Create a datetime string for a given date and time in Asia/Jerusalem timezone
 * This ensures proper timezone handling for FullCalendar events
 */
export function createJerusalemDateTime(dateString: string, timeString: string): string {
  // Parse the time
  const [hours, minutes] = timeString.split(':').map(num => parseInt(num));
  
  // Create a proper Date object and use toISOString() for better FullCalendar compatibility
  try {
    // Create a date object for the given date and time
    const dateTimeString = `${dateString}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    
    // Create Date object and let JavaScript handle the timezone
    const date = new Date(dateTimeString);
    
    // Use toISOString() for consistent formatting that FullCalendar understands
    return date.toISOString();
  } catch (error) {
    console.error('Error creating Jerusalem datetime:', error);
    // Fallback to basic datetime format
    return `${dateString}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  }
}

/**
 * Convert storage time (HH:MM) to display time by adding Jerusalem offset for calendar view
 * This handles day crossing when adding offset passes midnight
 */
export function toDisplayDateTime(dateString: string, timeString: string): { 
  displayDate: string; 
  displayTime: string; 
  date: Date 
} {
  const [hours, minutes] = timeString.split(':').map(num => parseInt(num));
  const offset = getJerusalemOffset();
  
  // Add Jerusalem offset for display
  let displayHours = hours + offset;
  let displayDate = dateString;
  
  // Handle day crossing
  if (displayHours >= 24) {
    displayHours -= 24;
    displayDate = addDaysToJerusalemDate(dateString, 1);
  }
  
  const displayTime = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  // Create Date object for FullCalendar
  const date = new Date(`${displayDate}T${displayTime}:00`);
  
  return {
    displayDate,
    displayTime,
    date
  };
}

/**
 * Convert display time back to storage time by subtracting Jerusalem offset
 * This handles day crossing when subtracting offset goes before midnight
 */
export function toStorageFromDisplay(displayDate: Date, displayTime?: string): {
  storageDate: string;
  storageTime: string | null;
} {
  if (!displayTime) {
    // All-day event - just return the date
    return {
      storageDate: formatJerusalemDate(displayDate),
      storageTime: null
    };
  }
  
  const [hours, minutes] = displayTime.split(':').map(num => parseInt(num));
  const offset = getJerusalemOffset();
  
  // Subtract Jerusalem offset for storage
  let storageHours = hours - offset;
  let storageDate = formatJerusalemDate(displayDate);
  
  // Handle day crossing backwards
  if (storageHours < 0) {
    storageHours += 24;
    // Subtract one day from storage date
    const dateCopy = new Date(displayDate);
    dateCopy.setDate(dateCopy.getDate() - 1);
    storageDate = formatJerusalemDate(dateCopy);
  }
  
  const storageTime = `${storageHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  return {
    storageDate,
    storageTime
  };
}

/**
 * Extract time from Date object in HH:MM format
 * This is used when getting time from FullCalendar drag events
 */
export function extractTimeFromDate(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Week calculation utilities for desktop schedule duplication
 */

/**
 * Get the start of week (Sunday) for a given date in Jerusalem timezone
 */
export function getWeekStart(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  return weekStart;
}

/**
 * Get the end of week (Saturday) for a given date in Jerusalem timezone
 */
export function getWeekEnd(date: Date): Date {
  const dayOfWeek = date.getDay();
  const weekEnd = new Date(date);
  weekEnd.setDate(date.getDate() + (6 - dayOfWeek));
  return weekEnd;
}

/**
 * Get all days of a week as Date objects (Sunday to Saturday)
 */
export function getWeekDays(weekStartDate: Date): Date[] {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStartDate);
    day.setDate(weekStartDate.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Get formatted week range string for display (e.g., "15/09 - 21/09")
 */
export function getWeekRangeString(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startFormatted = format(weekStart, 'dd/MM', { locale: he });
  const endFormatted = format(weekEnd, 'dd/MM', { locale: he });
  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Get the currently displayed week based on a reference date (usually current calendar view)
 */
export function getCurrentDisplayedWeek(referenceDate: Date): {
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  rangeString: string;
} {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd = getWeekEnd(weekStart);
  const days = getWeekDays(weekStart);
  const rangeString = getWeekRangeString(weekStart);
  
  return {
    weekStart,
    weekEnd,
    days,
    rangeString
  };
}

/**
 * Generate upcoming weeks for selection (excluding current week)
 */
export function getUpcomingWeeks(currentWeekStart: Date, numberOfWeeks: number = 8): Array<{
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  rangeString: string;
  weekNumber: number;
}> {
  const weeks = [];
  
  for (let i = 1; i <= numberOfWeeks; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() + (i * 7));
    
    const weekEnd = getWeekEnd(weekStart);
    const days = getWeekDays(weekStart);
    const rangeString = getWeekRangeString(weekStart);
    
    weeks.push({
      weekStart,
      weekEnd,
      days,
      rangeString,
      weekNumber: i
    });
  }
  
  return weeks;
}

/**
 * Get Hebrew day names (short format)
 */
export function getHebrewDayName(dayIndex: number): string {
  const dayNames = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
  return `יום ${dayNames[dayIndex]}`;
}

/**
 * Create bulk duplication request from selected days and target weeks
 */
export function createBulkDuplicationRequest(
  selectedDays: { date: Date; dayIndex: number }[],
  targetWeeks: Date[]
): {
  sourceDates: string[];
  targetDates: string[];
} {
  const sourceDates: string[] = [];
  const targetDates: string[] = [];
  
  // For each target week
  targetWeeks.forEach(targetWeekStart => {
    const targetWeekDays = getWeekDays(targetWeekStart);
    
    // For each selected source day
    selectedDays.forEach(({ date, dayIndex }) => {
      const sourceDate = formatJerusalemDate(date);
      const targetDate = formatJerusalemDate(targetWeekDays[dayIndex]);
      
      sourceDates.push(sourceDate);
      targetDates.push(targetDate);
    });
  });
  
  return { sourceDates, targetDates };
}
