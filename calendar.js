// Sidereal Calendar. Calendar maths comes from sidereal-core.js, shared rooms from rooms.js.
document.addEventListener('DOMContentLoaded', function () {
  const S = SiderealCore;
  const R = SiderealRooms;
  const $ = id => document.getElementById(id);

  const DAY_MS = 86400000, HOUR_MS = 3600000;
  const RETURN_MONTH = 10;                       // month index used for the Return days
  const MAX_YEAR = 100;

  const calendarBody = $('calendar-body');
  const yearSelect = $('year-select');
  const monthSelect = $('month-select');
  const seasonLabel = $('season-label');
  const infoOutput = $('hour-display-output');

  // ---- Location and work settings (shared with the clock through localStorage) ----
  let MY_LAT = parseFloat(localStorage.getItem('user_lat')) || 51.5074;
  let MY_LONG = parseFloat(localStorage.getItem('user_long')) || -0.1278;
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function workSettings() {
    const zone = localStorage.getItem('work_zone') ||
      (localStorage.getItem('lock_to_uk') === 'true' ? 'Europe/London' : '');   // old setting
    return { zone: zone || deviceZone, follow: localStorage.getItem('work_follow_dst') === 'true' };
  }

  function updateLocationUI() {
    const latStr = `${Math.abs(MY_LAT).toFixed(2)}° ${MY_LAT >= 0 ? 'N' : 'S'}`;
    const longStr = `${Math.abs(MY_LONG).toFixed(2)}° ${MY_LONG >= 0 ? 'E' : 'W'}`;
    $('location-display').textContent = `${latStr}, ${longStr}`;
  }

  function updateLocation(lat, long) {
    MY_LAT = parseFloat(lat);
    MY_LONG = parseFloat(long);
    localStorage.setItem('user_lat', MY_LAT);
    localStorage.setItem('user_long', MY_LONG);
    updateLocationUI();
    applyHighlights();
  }

  // ---- Small helpers ---------------------------------------------------------------
  const SUN_ICON = '<svg class="celestial-icon" viewBox="0 0 24 24" fill="orange" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg>';
  const MOON_ICON = '<svg class="celestial-icon" viewBox="0 0 24 24" fill="#4a5568" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const pad2 = n => String(n).padStart(2, '0');

  const debounce = (fn, delay) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  };

  // Cells are plain text: safer for shared rooms (nothing typed by someone else can run as code).
  const PLAINTEXT = (() => { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; })();
  const setEditable = (el, on) => { el.contentEditable = on ? (PLAINTEXT ? 'plaintext-only' : 'true') : 'false'; };
  function readText(el) {
    const t = el.innerText.replace(/\u200B/g, '');
    return t.trim() === '' ? '' : t.replace(/\n+$/, '');
  }

  const monthDays = (year, month) => month < RETURN_MONTH ? S.DAYS_PER_MONTH : S.daysInYear(year) - 360;
  const dayStartMs = (year, month, day) =>
    (S.EPOCH_DAY_NUMBER + S.yearStartDayIndex(year) + month * S.DAYS_PER_MONTH + (day - 1)) * DAY_MS;
  const monthName = m => m < RETURN_MONTH ? S.MONTHS[m] : 'Return days';

  // ---- Table header -----------------------------------------------------------------
  function buildHeader() {
    const cols = ['<col style="width:74px">', '<col style="width:150px">'];
    let sub = '';
    for (let h = 0; h < S.HOURS_PER_DAY; h++) { cols.push('<col style="width:88px">'); sub += `<th>${pad2(h)}</th>`; }
    $('calendar-table').insertAdjacentHTML('afterbegin', `<colgroup>${cols.join('')}</colgroup>`);
    $('header-row-main').innerHTML =
      `<th rowspan="2" class="day-col">Day</th><th rowspan="2">Whole Day</th><th colspan="${S.HOURS_PER_DAY}">Hours (planet time)</th>`;
    $('header-row-sub').innerHTML = sub;
  }

  // ---- Local storage ----------------------------------------------------------------
  const storageKey = () => `sidereal2-${yearSelect.value}-${monthSelect.value}`;

  function saveData() {
    const data = { wholeDay: {}, hours: {} };
    calendarBody.querySelectorAll('tr').forEach(row => {
      const day = row.dataset.dayRow;
      const whole = readText(row.querySelector('.whole-day-content'));
      if (whole) data.wholeDay[day] = whole;
      row.querySelectorAll('.hour-cell').forEach(cell => {
        const text = readText(cell.querySelector('.pane-local'));
        if (text) { (data.hours[day] = data.hours[day] || {})[cell.dataset.hour] = { content: text }; }
      });
    });
    localStorage.setItem(storageKey(), JSON.stringify(data));
  }
  const debouncedSaveData = debounce(saveData, 500);

  function loadData() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(storageKey())); } catch (e) { /* ignore */ }
    if (!data) return;
    for (const day in data.wholeDay || {}) {
      const el = calendarBody.querySelector(`tr[data-day-row='${day}'] .whole-day-content`);
      if (el) el.textContent = data.wholeDay[day];
    }
    for (const day in data.hours || {}) {
      for (const hour in data.hours[day]) {
        const el = calendarBody.querySelector(`.hour-cell[data-day='${day}'][data-hour='${hour}'] .pane-local`);
        if (el) el.textContent = data.hours[day][hour].content || '';
      }
    }
  }

  // ---- Building the month -------------------------------------------------------------
  let viewToken = 0;           // changes every time the month is rebuilt, so slow room loads can be ignored

  function updateSeasonLabel() {
    const year = +yearSelect.value, month = +monthSelect.value;
    if (month === RETURN_MONTH) {
      const n = monthDays(year, month);
      seasonLabel.textContent = `${n} Return days${S.isLeapYear(year) ? ' (leap year)' : ''}: the year turns over`;
      return;
    }
    const first = Math.floor((month * 36) / 90), last = Math.floor((month * 36 + 35) / 90);
    seasonLabel.textContent = first === last
      ? `Season ${S.SEASONS[first]}`
      : `Seasons ${S.SEASONS[first]} → ${S.SEASONS[last]} (change on day ${last * 90 - month * 36 + 1})`;
  }

  function createCalendar() {
    viewToken++;
    const year = +yearSelect.value, month = +monthSelect.value, days = monthDays(year, month);
    calendarBody.innerHTML = '';
    clearHighlights();

    for (let day = 1; day <= days; day++) {
      const doy = month * S.DAYS_PER_MONTH + day - 1;           // 0-based day of the year
      const tr = document.createElement('tr');
      tr.dataset.dayRow = day;

      const dayTd = document.createElement('td');
      dayTd.className = 'day-number';
      if (month < RETURN_MONTH) {
        const wd = S.WEEKDAYS[(day - 1) % S.DAYS_PER_WEEK];
        dayTd.innerHTML = `<span class="dn">${day}</span><span class="wd" title="${wd.name}">${wd.glyph}</span>`;
        if ((day - 1) % S.DAYS_PER_WEEK === 0) tr.classList.add('week-start');
        if (doy % S.DAYS_PER_SEASON === 0) {
          tr.classList.add('season-start');
          dayTd.insertAdjacentHTML('beforeend', `<span class="season-badge">${S.SEASONS[doy / S.DAYS_PER_SEASON]}</span>`);
        }
      } else {
        dayTd.innerHTML = `<span class="dn">R${day}</span><span class="wd">Return</span>`;
        tr.classList.add('return-row');
      }
      tr.appendChild(dayTd);

      const wholeTd = document.createElement('td');
      wholeTd.className = 'whole-day-cell';
      const whole = document.createElement('div');
      whole.className = 'whole-day-content';
      whole.dataset.placeholder = 'Whole day…';
      setEditable(whole, true);
      whole.addEventListener('input', debouncedSaveData);
      wholeTd.appendChild(whole);
      tr.appendChild(wholeTd);

      for (let hour = 0; hour < S.HOURS_PER_DAY; hour++) {
        const td = document.createElement('td');
        td.className = 'hour-cell';
        td.dataset.day = day;
        td.dataset.hour = hour;

        const wrap = document.createElement('div');
        wrap.className = 'hour-dual-container';

        const local = document.createElement('div');
        local.className = 'pane-local';
        local.dataset.placeholder = 'Local…';
        setEditable(local, true);
        local.addEventListener('input', debouncedSaveData);
        local.addEventListener('click', handleCellClick);

        const shared = document.createElement('div');
        shared.className = 'pane-shared';
        shared.dataset.day = day;
        shared.dataset.hour = hour;
        if (roomActive) {
          setEditable(shared, true);
          shared.classList.add('connected');
          shared.dataset.placeholder = 'Shared…';
          shared.addEventListener('input', () => debouncedSaveShared(shared, day, hour));
        } else {
          setEditable(shared, false);
          shared.dataset.placeholder = 'Shared (offline)';
        }
        shared.addEventListener('click', handleCellClick);

        wrap.appendChild(local);
        wrap.appendChild(shared);
        td.appendChild(wrap);
        tr.appendChild(td);
      }
      calendarBody.appendChild(tr);
    }

    updateSeasonLabel();
    loadData();
    applyHighlights();
    if (roomActive) loadShared();
  }

  // ---- Work hours, sunrise and sunset ---------------------------------------------------
  function overlapsWindow(hour, win) {
    return ((hour - win.start + 24) % 24) < win.length || ((win.start - hour + 24) % 24) < 1;
  }

  function applyHighlights() {
    const year = +yearSelect.value, month = +monthSelect.value;
    const { zone, follow } = workSettings();

    calendarBody.querySelectorAll('tr').forEach(tr => {
      const start = dayStartMs(year, month, +tr.dataset.dayRow);
      const win = S.workWindowUTC(zone, new Date(start + 12 * HOUR_MS), { followDST: follow });

      // Sunrise and sunset events that fall within this planet-time day, wherever the viewer lives.
      const events = [];
      try {
        const seen = new Set();
        for (const shift of [-1, 0, 1]) {
          const t = SunCalc.getTimes(new Date(start + 12 * HOUR_MS + shift * DAY_MS), MY_LAT, MY_LONG);
          [['rise', t.sunrise], ['set', t.sunset]].forEach(([kind, d]) => {
            const ms = d.getTime();
            const key = kind + Math.round(ms / 60000);
            if (!isNaN(ms) && ms >= start && ms < start + DAY_MS && !seen.has(key)) { seen.add(key); events.push([kind, ms]); }
          });
        }
      } catch (e) { /* SunCalc not available (offline), skip the icons */ }

      tr.querySelectorAll('.hour-cell').forEach(cell => {
        const hour = +cell.dataset.hour;
        cell.classList.toggle('hour-working', overlapsWindow(hour, win));
        const old = cell.querySelector('.celestial-icon');
        if (old) old.remove();
        events.forEach(([kind, ms]) => {
          if (Math.floor((ms - start) / HOUR_MS) === hour) cell.insertAdjacentHTML('beforeend', kind === 'rise' ? SUN_ICON : MOON_ICON);
        });
      });
    });
  }

  // ---- Showing the matching ordinary date and time ------------------------------------------
  let isLocked = false;

  function describeCell(cell) {
    const year = +yearSelect.value, month = +monthSelect.value;
    const start = dayStartMs(year, month, +cell.dataset.day) + (+cell.dataset.hour) * HOUR_MS;
    const s = new Date(start), e = new Date(start + HOUR_MS);
    const t = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${s.toLocaleDateString('en-GB')} ${t(s)}–${t(e)} (your clock)`;
  }

  function handleCellClick(event) {
    isLocked = true;
    infoOutput.textContent = describeCell(event.target.closest('.hour-cell'));
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.hour-cell') && !e.target.closest('#calendar-body') && !e.target.closest('#hour-display-output')) {
      isLocked = false;
      infoOutput.textContent = 'Click an Hour box';
    }
  });

  calendarBody.addEventListener('mouseover', e => {
    if (isLocked) return;
    const cell = e.target.closest('.hour-cell');
    if (cell) infoOutput.textContent = describeCell(cell);
  });

  // ---- Today, Go to, and moving between months -------------------------------------------------
  let currentHighlight = null;

  function clearHighlights() {
    if (currentHighlight) {
      currentHighlight.row.classList.remove('today-highlight');
      currentHighlight.cell.classList.remove('today-highlight-hour');
      currentHighlight = null;
    }
  }

  // Where an instant sits in the calendar: {year, month, day, hour, cal}
  function locate(date) {
    const cal = S.fromDate(date);
    return {
      year: cal.year,
      month: cal.isReturnDay ? RETURN_MONTH : cal.monthIndex,
      day: cal.isReturnDay ? cal.returnDay : cal.day,
      hour: cal.time.hour,
      cal
    };
  }

  function showLocation(loc) {
    yearSelect.value = loc.year;
    monthSelect.value = loc.month;
    createCalendar();
    const row = calendarBody.querySelector(`tr[data-day-row='${loc.day}']`);
    const cell = calendarBody.querySelector(`.hour-cell[data-day='${loc.day}'][data-hour='${loc.hour}']`);
    if (row && cell) {
      row.classList.add('today-highlight');
      cell.classList.add('today-highlight-hour');
      currentHighlight = { row, cell };
      cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }

  $('today-btn').addEventListener('click', () => showLocation(locate(new Date())));

  function executeGoTo() {
    const input = $('datetime-input').value.trim();
    const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) { infoOutput.textContent = 'Invalid format. Use DD/MM/YYYY HH:MM'; return; }
    const date = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
    if (isNaN(date.getTime())) { infoOutput.textContent = 'Invalid date/time entered.'; return; }
    const loc = locate(date);
    if (loc.year < 0 || loc.year > MAX_YEAR) { infoOutput.textContent = `This calendar covers years 0 to ${MAX_YEAR} (April 2000 onwards).`; return; }
    showLocation(loc);
    const c = loc.cal;
    infoOutput.textContent = c.isReturnDay
      ? `Year ${c.year}, Return day ${c.returnDay}, hour ${pad2(c.time.hour)}`
      : `Year ${c.year}, ${c.season} ${c.month} ${c.day} ${c.weekdayGlyph}, hour ${pad2(c.time.hour)}`;
  }
  $('go-to-btn').addEventListener('click', executeGoTo);
  $('datetime-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); executeGoTo(); } });

  function step(delta) {
    const index = (+yearSelect.value) * 11 + (+monthSelect.value) + delta;
    if (index < 0 || index > MAX_YEAR * 11 + RETURN_MONTH) return;
    yearSelect.value = Math.floor(index / 11);
    monthSelect.value = index % 11;
    createCalendar();
  }
  $('prev-month-btn').addEventListener('click', () => step(-1));
  $('next-month-btn').addEventListener('click', () => step(1));
  yearSelect.addEventListener('change', createCalendar);
  monthSelect.addEventListener('change', createCalendar);

  function populateSelects() {
    for (let y = 0; y <= MAX_YEAR; y++) yearSelect.add(new Option(y, y));
    for (let m = 0; m <= RETURN_MONTH; m++) monthSelect.add(new Option(monthName(m), m));
    const now = locate(new Date());
    yearSelect.value = Math.min(Math.max(now.year, 0), MAX_YEAR);
    monthSelect.value = now.month;
  }

  // ---- Rooms ----------------------------------------------------------------------------------
  let roomActive = false;
  let currentRoom = '';
  const joinBtn = $('join-room-btn');
  const roomStatus = $('room-status');

  function setStatus(text, color) { roomStatus.textContent = text; roomStatus.style.color = color; }

  async function loadShared() {
    const token = viewToken;
    try {
      const rows = await R.loadMonth(+yearSelect.value, +monthSelect.value);
      if (token !== viewToken) return;               // the month changed while loading
      calendarBody.querySelectorAll('.pane-shared').forEach(p => { p.textContent = ''; });
      rows.forEach(r => {
        const pane = calendarBody.querySelector(`.pane-shared[data-day='${r.day}'][data-hour='${r.hour}']`);
        if (pane) pane.textContent = r.content || '';
      });
    } catch (e) {
      console.error('Error loading shared data:', e);
      setStatus('Could not load shared data', '#dc2626');
    }
  }

  const debouncedSaveShared = debounce(async (pane, day, hour) => {
    if (!roomActive) return;
    const res = await R.saveCell({
      year: +yearSelect.value, month: +monthSelect.value, day, hour, content: readText(pane)
    });
    if (res && res.ok === false) { console.error('Error saving shared cell:', res.message); setStatus('Could not save to the room', '#dc2626'); }
  }, 500);

  R.onChange(cell => {
    if (!roomActive || cell.year !== +yearSelect.value || cell.month !== +monthSelect.value) return;
    const pane = calendarBody.querySelector(`.pane-shared[data-day='${cell.day}'][data-hour='${cell.hour}']`);
    if (pane && document.activeElement !== pane) pane.textContent = cell.content || '';
  });

  async function handleJoinOrLeave() {
    if (roomActive) {
      R.leave();
      roomActive = false; currentRoom = '';
      joinBtn.textContent = 'Join Room';
      setStatus('Offline Mode', '#718096');
      createCalendar();
      return;
    }
    const name = $('room-input').value.trim().toLowerCase();
    const password = $('room-password-input').value.trim();
    if (!name || !password) { alert('Please enter both Room Name and Password.'); return; }

    setStatus('Verifying credentials…', '#df8a14');
    const res = await R.join(name, password);
    if (!res.ok) {
      if (res.reason === 'bad-credentials') alert('Incorrect Room Name or Password.');
      else alert('An error occurred while joining the room.');
      setStatus('Offline Mode', '#718096');
      return;
    }
    roomActive = true; currentRoom = name;
    joinBtn.textContent = 'Leave Room';
    setStatus(`Connected: ${name.toUpperCase()}${res.created ? ' (new practice room)' : ''}`, '#10b981');
    createCalendar();
  }

  function setupRooms() {
    if (!R.enabled) { $('room-controls').style.display = 'none'; return; }
    if (R.mode === 'practice') $('practice-badge').hidden = false;
    joinBtn.addEventListener('click', handleJoinOrLeave);
    $('room-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleJoinOrLeave(); });
  }

  // ---- Location button -----------------------------------------------------------------------
  function promptForManualInput() {
    const text = prompt("Enter location manually as 'latitude, longitude'\n(Example: 51.51, -0.13 for London)\n\nLook up decimal values on latlong.net.");
    if (!text) { updateLocationUI(); return; }
    const parts = text.split(',');
    const lat = parseFloat(parts[0]), long = parseFloat(parts[1]);
    if (parts.length === 2 && !isNaN(lat) && !isNaN(long)) updateLocation(lat, long);
    else { alert("Please use the format 'latitude, longitude' with numbers."); updateLocationUI(); }
  }

  $('location-btn').addEventListener('click', () => {
    const useGPS = confirm("📍 Update Location Settings:\n\n• Click 'OK' to auto-detect using your device's GPS.\n• Click 'Cancel' to input your coordinates manually.");
    if (!useGPS) { promptForManualInput(); return; }
    if (!('geolocation' in navigator)) { alert('Geolocation is not supported by this browser.'); promptForManualInput(); return; }
    $('location-display').textContent = 'Detecting...';
    navigator.geolocation.getCurrentPosition(
      p => updateLocation(p.coords.latitude, p.coords.longitude),
      () => { alert('GPS detection failed or was blocked. Switching to manual input...'); promptForManualInput(); }
    );
  });

  // ---- Work zone picker ------------------------------------------------------------------------
  function fmtOffset(h) {
    const m = Math.round(Math.abs(h) * 60);
    return `UTC${h < 0 ? '-' : '+'}${Math.floor(m / 60)}${m % 60 ? ':' + pad2(m % 60) : ''}`;
  }
  function zoneLabel(z) {
    const now = new Date();
    const off = workSettings().follow ? S.zoneOffsetHours(z, now) : S.zoneStandardOffsetHours(z, now);
    return `${z.replace(/_/g, ' ')} (${fmtOffset(off)})`;
  }
  function refreshZoneLabels() {
    [...$('work-zone').options].slice(1).forEach(o => { o.textContent = zoneLabel(o.value); });
  }

  function setupWorkControls() {
    const select = $('work-zone'), box = $('follow-dst');
    const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []).filter(z => z.includes('/') || z === 'UTC');
    const fallback = ['Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
    select.add(new Option(`My time zone (${deviceZone})`, ''));
    (zones.length ? zones : fallback).forEach(z => select.add(new Option(zoneLabel(z), z)));
    select.value = localStorage.getItem('work_zone') || (localStorage.getItem('lock_to_uk') === 'true' ? 'Europe/London' : '');
    box.checked = workSettings().follow;

    select.addEventListener('change', () => {
      if (select.value) localStorage.setItem('work_zone', select.value); else localStorage.removeItem('work_zone');
      applyHighlights();
    });
    box.addEventListener('change', () => {
      localStorage.setItem('work_follow_dst', box.checked);
      refreshZoneLabels();
      applyHighlights();
    });
  }

  // Changes made in the clock (another tab) show up here too.
  window.addEventListener('storage', e => {
    if (e.key === 'user_lat') MY_LAT = parseFloat(e.newValue) || 51.5074;
    if (e.key === 'user_long') MY_LONG = parseFloat(e.newValue) || -0.1278;
    if (e.key === 'work_zone') $('work-zone').value = e.newValue || '';
    if (e.key === 'work_follow_dst') { $('follow-dst').checked = e.newValue === 'true'; refreshZoneLabels(); }
    if (['user_lat', 'user_long', 'work_zone', 'work_follow_dst'].includes(e.key)) { updateLocationUI(); applyHighlights(); }
  });

  // ---- Export and import -------------------------------------------------------------------------
  // Exports include the old-layout entries (sidereal-calendar-...) too, so they are backed up.
  const DATA_PREFIXES = ['sidereal2-', 'sidereal-calendar-'];

  function exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (DATA_PREFIXES.some(p => key.startsWith(p))) data[key] = localStorage.getItem(key);
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'sidereal-calendar-data.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Calendar data exported successfully!');
  }

  function mergeMonth(existing, imported) {
    Object.assign(existing.wholeDay = existing.wholeDay || {}, imported.wholeDay || {});
    ['hours', 'nares'].forEach(group => {
      if (!imported[group]) return;
      existing[group] = existing[group] || {};
      for (const day in imported[group]) Object.assign(existing[group][day] = existing[group][day] || {}, imported[group][day]);
    });
    return existing;
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) { alert('No file selected.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        let changed = false;
        for (const key in imported) {
          if (!DATA_PREFIXES.some(p => key.startsWith(p))) continue;
          const incoming = JSON.parse(imported[key]);
          const existingText = localStorage.getItem(key);
          localStorage.setItem(key, existingText ? JSON.stringify(mergeMonth(JSON.parse(existingText), incoming)) : imported[key]);
          changed = true;
        }
        if (changed) { alert('Calendar data merged successfully!'); createCalendar(); }
        else alert('No new calendar data was found to merge.');
      } catch (err) {
        alert('Error importing file. Please ensure it is a valid JSON file.');
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
  }

  $('export-btn').addEventListener('click', exportData);
  $('import-btn').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', importData);

  // ---- Start up -----------------------------------------------------------------------------------
  buildHeader();
  updateLocationUI();
  populateSelects();
  setupWorkControls();
  setupRooms();
  createCalendar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered for Calendar'))
      .catch(error => console.error('Service Worker Registration Failed:', error));
  }
});
