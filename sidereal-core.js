/*
 * sidereal-core.js
 * Shared time and calendar maths for the Sidereal Clock and the Sidereal Calendar.
 * No DOM code in here, so both apps can load the same file.
 *
 * YEAR   One lap of the Sun against the stars: 31,558,149.76 s (365.256363 days).
 *        Year 0 starts when the Sun crosses sidereal 0 degrees (Lahiri):
 *        2000-04-13 11:52:11 UTC.
 * DAY    One mean solar day at Greenwich (UTC). One planet-wide clock and date for
 *        everyone; time zones only matter for work windows, not for the clock.
 * UNITS  1 day = 24 hours x 50 dins x 10 secs x 10 pings
 *        (hour 60 min, din 72 s, sec 7.2 s, ping 0.72 s).
 * CALENDAR  10 months x 36 days (6 weeks of 6 days), 4 seasons of 90 days,
 *        then 5 Return days (6 in leap years). Leap years: 10 in every 39.
 */
(function (root) {
  'use strict';

  // ---- Constants -------------------------------------------------------
  const SIDEREAL_YEAR_SECS = 31558149.76;
  const SIDEREAL_YEAR_DAYS = SIDEREAL_YEAR_SECS / 86400;

  // The instant of Year 0 (for reference; the calendar counts whole local days).
  const EPOCH_UTC_MS = Date.UTC(2000, 3, 13, 11, 52, 11);
  // UTC date of Year 0, day 1, as a count of days since 1970-01-01.
  const EPOCH_DAY_NUMBER = Date.UTC(2000, 3, 13) / 86400000;

  const HOURS_PER_DAY = 24, DINS_PER_HOUR = 50, SECS_PER_DIN = 10, PINGS_PER_SEC = 10;
  const DAY_MS = 86400000;
  const HOUR_MS = DAY_MS / HOURS_PER_DAY;               // 3,600,000
  const DIN_MS = HOUR_MS / DINS_PER_HOUR;               //    72,000
  const SEC_MS = DIN_MS / SECS_PER_DIN;                 //     7,200
  const PING_MS = SEC_MS / PINGS_PER_SEC;               //       720
  const PINGS_PER_DAY = HOURS_PER_DAY * DINS_PER_HOUR * SECS_PER_DIN * PINGS_PER_SEC; // 120,000

  const MONTHS_PER_YEAR = 10, DAYS_PER_MONTH = 36, DAYS_PER_WEEK = 6;
  const DAYS_PER_SEASON = 90, REGULAR_DAYS = 360;

  // Leap rule: 10 leap years in every 39. The phase of 35 puts leap years at
  // 0, 3, 7, 11, ... 35 and keeps the calendar within about 12 hours of the
  // true Sun crossing indefinitely.
  const LEAP_NUM = 10, LEAP_DEN = 39, LEAP_PHASE = 35;

  const SEASONS = ['α', 'β', 'γ', 'δ'];
  const MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const WEEKDAYS = [
    { name: 'Mercury', glyph: '☿' },
    { name: 'Venus',   glyph: '♀' },
    { name: 'Mars',    glyph: '♂' },
    { name: 'Jupiter', glyph: '♃' },
    { name: 'Saturn',  glyph: '♄' },
    { name: 'Moon',    glyph: '☽' }
  ];

  // ---- Leap years ------------------------------------------------------
  const leapsBefore = n => Math.floor((n + LEAP_PHASE) * LEAP_NUM / LEAP_DEN);

  /** True if sidereal year n has 6 Return days. */
  function isLeapYear(n) {
    return leapsBefore(n + 1) - leapsBefore(n) === 1;
  }

  /** Day index (0 = Year 0 day 1) on which year n begins. */
  function yearStartDayIndex(n) {
    return 365 * n + leapsBefore(n) - leapsBefore(0);
  }

  function daysInYear(n) { return 365 + (isLeapYear(n) ? 1 : 0); }

  // ---- Day count -------------------------------------------------------
  /** Whole days since Year 0 day 1, counted on the UTC (Greenwich) day. Negative before it. */
  function dayIndexOf(date) {
    return Math.floor(date.getTime() / DAY_MS) - EPOCH_DAY_NUMBER;
  }

  function yearOfDayIndex(dayIndex) {
    let n = Math.floor(dayIndex / SIDEREAL_YEAR_DAYS);
    while (yearStartDayIndex(n) > dayIndex) n--;
    while (yearStartDayIndex(n + 1) <= dayIndex) n++;
    return n;
  }

  // ---- Full breakdown --------------------------------------------------
  /**
   * Everything the clock and calendar need for one instant. The answer is the same everywhere.
   * Return days have season/month/weekday set to null.
   */
  function fromDate(date) {
    const lmt = date.getTime();
    const dayIndex = Math.floor(lmt / DAY_MS) - EPOCH_DAY_NUMBER;
    const year = yearOfDayIndex(dayIndex);
    const dayOfYear = dayIndex - yearStartDayIndex(year);       // 0-based
    const leap = isLeapYear(year);

    const cal = { year, leap, dayIndex, dayOfYear: dayOfYear + 1, isReturnDay: dayOfYear >= REGULAR_DAYS };
    if (!cal.isReturnDay) {
      const si = Math.floor(dayOfYear / DAYS_PER_SEASON);
      const mi = Math.floor(dayOfYear / DAYS_PER_MONTH);
      const dim = (dayOfYear % DAYS_PER_MONTH) + 1;
      const wi = (dim - 1) % DAYS_PER_WEEK;
      Object.assign(cal, {
        seasonIndex: si, season: SEASONS[si],
        monthIndex: mi, month: MONTHS[mi],
        day: dim,
        week: Math.floor((dim - 1) / DAYS_PER_WEEK) + 1,
        weekdayIndex: wi, weekday: WEEKDAYS[wi].name, weekdayGlyph: WEEKDAYS[wi].glyph
      });
    } else {
      Object.assign(cal, {
        seasonIndex: null, season: null, monthIndex: null, month: null,
        day: null, week: null, weekdayIndex: null, weekday: null, weekdayGlyph: null,
        returnDay: dayOfYear - REGULAR_DAYS + 1,
        returnDaysInYear: daysInYear(year) - REGULAR_DAYS
      });
    }

    // Time of day. Whole units use integer maths on milliseconds.
    const todMs = ((lmt % DAY_MS) + DAY_MS) % DAY_MS;
    const pingsToday = Math.floor(todMs / PING_MS);
    cal.time = {
      hour: Math.floor(pingsToday / (DINS_PER_HOUR * SECS_PER_DIN * PINGS_PER_SEC)),
      din:  Math.floor(pingsToday / (SECS_PER_DIN * PINGS_PER_SEC)) % DINS_PER_HOUR,
      sec:  Math.floor(pingsToday / PINGS_PER_SEC) % SECS_PER_DIN,
      ping: pingsToday % PINGS_PER_SEC
    };
    // Smooth values for hand angles: hours 0-24, dins 0-50, secs 0-10.
    cal.hands = {
      hours: todMs / HOUR_MS,
      dins:  (todMs % HOUR_MS) / DIN_MS,
      secs:  (todMs % DIN_MS) / SEC_MS
    };
    cal.hourOfDay = todMs / HOUR_MS;                            // 0-24 on the dial, midnight (UTC) at the top
    return cal;
  }

  // ---- Conversions for the calendar app --------------------------------
  /** Day index for a sidereal date. Pass {year, month (1-10), day (1-36)} or {year, returnDay (1-6)}. */
  function dayIndexFromCalendar(d) {
    const start = yearStartDayIndex(d.year);
    if (d.returnDay != null) return start + REGULAR_DAYS + (d.returnDay - 1);
    return start + (d.month - 1) * DAYS_PER_MONTH + (d.day - 1);
  }

  /** Ordinary (UTC) calendar date on which a day index begins: {y, m, d}. */
  function gregorianOfDayIndex(dayIndex) {
    const dt = new Date((EPOCH_DAY_NUMBER + dayIndex) * DAY_MS);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  // ---- Time zones (work windows only) ---------------------------------
  /** UTC offset in hours (may be fractional, e.g. 5.5) of an IANA time zone at an instant. */
  function zoneOffsetHours(timeZone, date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(date);
    const g = type => Number(parts.find(p => p.type === type).value);
    const wall = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
    return (wall - Math.floor(date.getTime() / 1000) * 1000) / 3600000;
  }

  /**
   * A zone's standard-time offset (no daylight saving): the smaller of its January and July
   * offsets in the year of `date`. Right for nearly every zone, including the southern hemisphere.
   */
  function zoneStandardOffsetHours(timeZone, date) {
    const y = date.getUTCFullYear();
    return Math.min(zoneOffsetHours(timeZone, new Date(Date.UTC(y, 0, 1))),
                    zoneOffsetHours(timeZone, new Date(Date.UTC(y, 6, 1))));
  }

  /**
   * A work window (default 9 to 17 on that zone's clock) expressed on the planet dial:
   * {start, length} in hours from UTC midnight. The start can wrap past the top of the dial.
   * By default daylight saving is ignored, so the window never moves; set followDST to true
   * to follow the zone's real clock changes.
   * options: { startHour = 9, endHour = 17, followDST = false }
   */
  function workWindowUTC(timeZone, date, options) {
    const o = options || {};
    const s = o.startHour == null ? 9 : o.startHour, e = o.endHour == null ? 17 : o.endHour;
    const off = o.followDST ? zoneOffsetHours(timeZone, date) : zoneStandardOffsetHours(timeZone, date);
    return { start: (((s - off) % 24) + 24) % 24, length: (e - s + 24) % 24 };
  }

  /** "Γ VI 11 ♄" style label, or "Return day 2" during the Return days. */
  function format(cal) {
    return cal.isReturnDay
      ? `Return day ${cal.returnDay}`
      : `${cal.season} ${cal.month} ${cal.day} ${cal.weekdayGlyph}`;
  }

  const api = {
    SIDEREAL_YEAR_SECS, SIDEREAL_YEAR_DAYS, EPOCH_UTC_MS, EPOCH_DAY_NUMBER,
    HOURS_PER_DAY, DINS_PER_HOUR, SECS_PER_DIN, PINGS_PER_SEC,
    HOUR_SECS: HOUR_MS / 1000, DIN_SECS: DIN_MS / 1000, SEC_SECS: SEC_MS / 1000, PING_SECS: PING_MS / 1000,
    MONTHS_PER_YEAR, DAYS_PER_MONTH, DAYS_PER_WEEK, DAYS_PER_SEASON,
    SEASONS, MONTHS, WEEKDAYS,
    isLeapYear, yearStartDayIndex, daysInYear, dayIndexOf, yearOfDayIndex,
    fromDate, dayIndexFromCalendar, gregorianOfDayIndex, format,
    zoneOffsetHours, zoneStandardOffsetHours, workWindowUTC
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SiderealCore = api;
})(typeof self !== 'undefined' ? self : this);
