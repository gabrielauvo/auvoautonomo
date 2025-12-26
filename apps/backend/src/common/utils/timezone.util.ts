/**
 * Timezone utilities for handling date/time conversions
 * Uses IANA timezone identifiers (e.g., 'America/Sao_Paulo', 'America/New_York')
 */

/**
 * Gets the UTC offset in minutes for a given timezone and date
 * Returns negative for timezones behind UTC (e.g., -180 for UTC-3)
 */
export function getTimezoneOffsetMinutes(
  timezone: string,
  date: Date = new Date(),
): number {
  // Get the timezone offset by comparing UTC time with local time in the timezone
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
}

/**
 * Gets start and end of day boundaries in UTC for a given date string and timezone
 * @param dateString Date in YYYY-MM-DD format
 * @param timezone IANA timezone identifier
 * @returns Object with start and end Date objects in UTC
 */
export function getDayBoundsInTimezone(
  dateString: string,
  timezone: string,
): { startOfDay: Date; endOfDay: Date } {
  // Parse the date string as a local date in the specified timezone
  // We need to create the date at midnight in the target timezone

  // Get the offset for the start of the day
  const tempStartDate = new Date(`${dateString}T00:00:00.000Z`);
  const startOffsetMinutes = getTimezoneOffsetMinutes(timezone, tempStartDate);

  // Create start of day: midnight in the timezone converted to UTC
  const startOfDay = new Date(`${dateString}T00:00:00.000Z`);
  startOfDay.setMinutes(startOfDay.getMinutes() + startOffsetMinutes);

  // Get the offset for the end of the day (may differ due to DST)
  const tempEndDate = new Date(`${dateString}T23:59:59.999Z`);
  const endOffsetMinutes = getTimezoneOffsetMinutes(timezone, tempEndDate);

  // Create end of day: 23:59:59.999 in the timezone converted to UTC
  const endOfDay = new Date(`${dateString}T23:59:59.999Z`);
  endOfDay.setMinutes(endOfDay.getMinutes() + endOffsetMinutes);

  return { startOfDay, endOfDay };
}

/**
 * Converts a UTC date to a date in the specified timezone
 * Returns a new Date object adjusted for the timezone offset
 */
export function convertUtcToTimezone(utcDate: Date, timezone: string): Date {
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, utcDate);
  const tzDate = new Date(utcDate.getTime() - offsetMinutes * 60 * 1000);
  return tzDate;
}

/**
 * Gets the date string (YYYY-MM-DD) for a UTC date in a specific timezone
 */
export function getDateStringInTimezone(utcDate: Date, timezone: string): string {
  // Use Intl.DateTimeFormat to get the correct date in the timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(utcDate);
}

/**
 * Formats a date in a specific timezone using Intl.DateTimeFormat
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    ...options,
  }).format(date);
}

/**
 * Gets the timezone abbreviation (e.g., 'BRT', 'EST', 'PST')
 */
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((part) => part.type === 'timeZoneName');
  return tzPart?.value || timezone;
}

/**
 * Validates if a timezone string is a valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
