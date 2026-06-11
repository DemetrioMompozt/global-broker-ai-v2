export const COLOMBIA_UTC_OFFSET_MINUTES = -300
export const COLOMBIA_TIMEZONE = 'America/Bogota'
export const COLOMBIA_GMT_LABEL = 'GMT-5'
export const NEW_YORK_TIMEZONE = 'America/New_York'
export const NEW_YORK_TIME_LABEL = 'New York / ET'
export const NY_PREMARKET_LEVELS_WINDOW = '09:00-09:30'
export const NY_CASH_OPEN = '09:30'
export const NY_FIRST_15_WINDOW = '09:30-09:45'
export const NY_MAIN_WINDOW = '09:45-16:00'

function timeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    weekday: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  const hour = Number(part('hour')) % 24
  return {
    day: Number(part('day')),
    hour,
    minute: Number(part('minute')),
    month: Number(part('month')),
    second: Number(part('second')),
    weekdayText: part('weekday'),
    year: Number(part('year')),
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dayForTimeZone(date: Date, timeZone: string) {
  const parts = timeZoneParts(date, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function minutesForTimeZone(date: Date, timeZone: string) {
  const parts = timeZoneParts(date, timeZone)
  return parts.hour * 60 + parts.minute
}

function weekdayForTimeZone(date: Date, timeZone: string) {
  const text = timeZoneParts(date, timeZone).weekdayText
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(text)
}

function offsetMinutesForTimeZone(date: Date, timeZone: string) {
  const parts = timeZoneParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUtc - date.getTime()) / 60_000)
}

function isoStringForTimeZone(date: Date, timeZone: string) {
  const parts = timeZoneParts(date, timeZone)
  const offsetMinutes = offsetMinutesForTimeZone(date, timeZone)
  const sign = offsetMinutes <= 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${offset}`
}

export function colombiaShiftedDate(date: Date, utcOffsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES) {
  return new Date(date.getTime() + utcOffsetMinutes * 60_000)
}

export function colombiaDay(date: Date, utcOffsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES) {
  return colombiaShiftedDate(date, utcOffsetMinutes).toISOString().slice(0, 10)
}

export function colombiaMinutes(date: Date, utcOffsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES) {
  const shifted = colombiaShiftedDate(date, utcOffsetMinutes)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

export function colombiaWeekday(date: Date, utcOffsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES) {
  return colombiaShiftedDate(date, utcOffsetMinutes).getUTCDay()
}

export function colombiaIsoString(date: Date, utcOffsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES) {
  const shifted = colombiaShiftedDate(date, utcOffsetMinutes)
  const sign = utcOffsetMinutes <= 0 ? '-' : '+'
  const absolute = Math.abs(utcOffsetMinutes)
  const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}${offset}`
}

export function colombiaClockTime(date: Date, utcOffsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES) {
  const shifted = colombiaShiftedDate(date, utcOffsetMinutes)
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

export function newYorkDay(date: Date) {
  return dayForTimeZone(date, NEW_YORK_TIMEZONE)
}

export function newYorkMinutes(date: Date) {
  return minutesForTimeZone(date, NEW_YORK_TIMEZONE)
}

export function newYorkWeekday(date: Date) {
  return weekdayForTimeZone(date, NEW_YORK_TIMEZONE)
}

export function newYorkIsoString(date: Date) {
  return isoStringForTimeZone(date, NEW_YORK_TIMEZONE)
}

export function newYorkClockTime(date: Date) {
  const parts = timeZoneParts(date, NEW_YORK_TIMEZONE)
  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

export function newYorkOffsetLabel(date: Date) {
  const offsetMinutes = offsetMinutesForTimeZone(date, NEW_YORK_TIMEZONE)
  const sign = offsetMinutes <= 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  return `GMT${sign}${Math.floor(absolute / 60)}`
}
