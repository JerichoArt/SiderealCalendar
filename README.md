# Sidereal Calendar

A personal calendar for the sidereal calendar system used by the [Sidereal Clock](#the-clock). Plan events by hour or by whole days, on a calendar that is the same for everyone on the planet. Everything is stored in your own browser, and you can share events by exporting and importing a file.

**Live version:** https://jerichoart.github.io/SiderealCalendar/

## The calendar system

| Unit | Length |
|---|---|
| Year | One sidereal lap of the Sun. Year 0 began on 13 April 2000 (UTC) |
| Month | 36 days, numbered I to X |
| Week | 6 days: ☿ Mercury, ♀ Venus, ♂ Mars, ♃ Jupiter, ♄ Saturn, ☽ Moon |
| Season | 90 days (15 weeks), named α β γ δ. A season can start partway through a month |
| Return days | 5 extra days after month X (6 in a leap year), the mandatory rest days |
| Day | 24 hours, shown in **planet time**, the same for everyone |

Leap years occur 10 times in every 39 years. Seasons are positions in Earth's orbit against the stars, not the weather. The calendar shows years 0 to 100 (April 2000 onwards).

## Using the calendar

### Finding your way around

- **Year** and **Month** selectors, with arrows to step month by month. After month X comes **Return days**, then the next year.
- The **Today** button jumps to the current day and hour.
- **Go to** takes a date as `DD/MM/YYYY`. Press Enter or click Go, and the calendar jumps to the sidereal day containing midday on that date.
- Hover over an hour to see the matching ordinary date and time on your own clock.

### Reading the table

- **Day column**: the day number, the weekday symbol and name, and a green badge (α, β, γ or δ) on the day a season begins. A thicker line marks the start of each week, and a green line the start of a season.
- **Whole Day column**: for events that cover whole days.
- **24 hour columns** (00 to 23, planet time), with these marks:
  - **Green hours** are your work window.
  - **☀** marks sunrise and **☾** sunset at your location.

### Season bar

The bar above the table shows how far through its season the selected day is, with week ticks and month starts marked. It stays at the top of the screen while you scroll. Click any day or hour to move its marker. Return days show a gold bar.

### Events

- **Add an hour event**: click an hour, or drag across several hours. A drag can run across midnight into the next day.
- **Add a whole-day event**: click a Whole Day box, or drag down several days.
- In the editor, set the text, change the length, pick a colour, or shift the start by an hour or a day. Click an event again to edit or delete it.
- Events that overlap are stacked, and an event that crosses midnight continues on the next day.
- On a touch screen, tap a cell and set the length in the editor.
- Event text is plain text, up to 2,000 characters.

### Location and work hours

- The **📍 button** sets your location by GPS or by typing coordinates. It is used for sunrise and sunset.
- **Work zone** sets which time zone's 09:00 to 17:00 is shown as green. The default is your device's zone. Someone in Australia working UK hours can pick Europe/London.
- **Follow local daylight saving** is off by default, so the green hours never move. Tick it to follow the zone's clock changes.

Location, work zone and the daylight-saving choice are shared with the clock when both are served from the same site (for example, both on `yourname.github.io`).

## Your data

- Events are saved **in your browser only**, on the device you used. Clearing the browser's site data deletes them. Press **Export Data** now and then as a backup.
- **Export Data** saves all your events as a `.json` file.
- **Import Data** reads a file exported by someone else (or by you) and **adds only the events you don't already have**. Anything already in your calendar is left unchanged, so importing never overwrites your entries, and importing the same file twice adds nothing new.
- Each event carries its own ID, which is how the calendar tells whether it already has an event.
- Entries from the earlier 50-day, 10-hour layout can't be converted and are not shown, though they remain in the browser's storage. Entries from the previous version of this layout are converted automatically.

Multi-user rooms (shared through Supabase) were removed from this version.

## Files

| File | What it does |
|---|---|
| `index.html` | The page and the event editor |
| `calendar.js` | The calendar: table, events, season bar, work hours, export and import |
| `calendar.css` | Styling |
| `sidereal-core.js` | All the calendar and time maths. **Shared with the clock, so keep the two copies identical** |
| `sw.js` | Offline support (network first, cache as a fallback) |
| `manifest.json` and icons | Makes the calendar installable as an app |

## Running it yourself

There is nothing to build.

1. Clone or download the repository.
2. Serve the folder with a local web server. In VS Code, the *Live Server* extension works. Opening `index.html` directly will not work, because service workers need `http://localhost` or `https`.
3. To publish, turn on GitHub Pages for the repository.

When you change any file, raise the version in `CACHE_NAME` in `sw.js` so installed copies refresh.

## Built with

- [SunCalc](https://github.com/mourner/suncalc) for sunrise and sunset
- Tailwind CSS 2 (CDN) and the Inter font
- Plain JavaScript, with no framework and no build step

## The clock

The Sidereal Clock shows the same planet-wide time and the same date on an analogue dial and digital display.
## Licence

Released under the [MIT Licence](LICENSE). Copyright (c) 2025 Željko Ivanković.

You are welcome to use it, adapt it and build on it. A link back to the original is appreciated but not required.
