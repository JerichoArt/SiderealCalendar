// Sidereal Calendar (local only). Calendar maths comes from sidereal-core.js.
document.addEventListener('DOMContentLoaded', function () {
  const S = SiderealCore;
  const $ = id => document.getElementById(id);

  const DAY_MS = 86400000, HOUR_MS = 3600000;
  const RETURN_MONTH = 10;                       // month index used for the Return days
  const MAX_YEAR = 100;
  const ROW_MIN = 56, LANE_TOP = 4, LANE_STEP = 24, FREE_ZONE = 26;
  const COLORS = ['green', 'blue', 'amber', 'rose', 'purple'];
  const EVENTS_KEY = 'sidereal3-events';

  const calendarBody = $('calendar-body');
  const yearSelect = $('year-select');
  const monthSelect = $('month-select');
  const seasonLabel = $('season-label');
  const infoOutput = $('hour-display-output');

  const pad2 = n => String(n).padStart(2, '0');
  const monthDays = (year, month) => month < RETURN_MONTH ? S.DAYS_PER_MONTH : S.daysInYear(year) - 360;
  const dayStartMs = (year, month, day) =>
    (S.EPOCH_DAY_NUMBER + S.yearStartDayIndex(year) + month * S.DAYS_PER_MONTH + (day - 1)) * DAY_MS;
  const monthName = m => m < RETURN_MONTH ? S.MONTHS[m] : 'Return days';

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

  // =====================================================================================
  // Events
  // An event is {id, type: 'hours' | 'days', start, end, text, color}. start and end are
  // planet-time instants in milliseconds, so an event never depends on how a month is laid out.
  // =====================================================================================
  const SUN_ICON = '<svg class="celestial-icon" viewBox="0 0 24 24" fill="orange" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg>';
  const MOON_ICON = '<svg class="celestial-icon" viewBox="0 0 24 24" fill="#4a5568" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  const newId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Checks and tidies one event (from storage or from an imported file). Returns null if unusable.
  function cleanEvent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const type = raw.type === 'days' ? 'days' : raw.type === 'hours' ? 'hours' : null;
    if (!type) return null;
    const unit = type === 'days' ? DAY_MS : HOUR_MS;
    const start = Number(raw.start), end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const s = Math.floor(start / unit) * unit;
    let e = Math.ceil(end / unit) * unit;
    if (e <= s) e = s + unit;
    if (e - s > 400 * DAY_MS) return null;
    const text = String(raw.text == null ? '' : raw.text).trim().slice(0, 2000);
    if (!text) return null;
    const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64 ? raw.id : newId();
    return { id, type, start: s, end: e, text, color: COLORS.includes(raw.color) ? raw.color : 'green' };
  }

  // Entries typed in the previous version of this calendar (one text per cell) become events.
  function eventsFromV2(key, value) {
    const m = key.match(/^sidereal2-(\d+)-(\d+)$/);
    if (!m) return [];
    let data;
    try { data = JSON.parse(value); } catch (e) { return []; }
    if (!data || typeof data !== 'object') return [];
    const year = +m[1], month = +m[2], out = [];
    for (const day in data.wholeDay || {}) {
      const s = dayStartMs(year, month, +day);
      out.push({ id: `v2-${year}-${month}-${day}-d`, type: 'days', start: s, end: s + DAY_MS, text: data.wholeDay[day], color: 'blue' });
    }
    for (const day in data.hours || {}) {
      for (const hour in data.hours[day]) {
        const s = dayStartMs(year, month, +day) + (+hour) * HOUR_MS;
        out.push({ id: `v2-${year}-${month}-${day}-${hour}`, type: 'hours', start: s, end: s + HOUR_MS, text: (data.hours[day][hour] || {}).content, color: 'green' });
      }
    }
    return out;
  }

  function loadEvents() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(EVENTS_KEY)) || []; } catch (e) { list = []; }
    list = list.map(cleanEvent).filter(Boolean);
    if (!localStorage.getItem('sidereal3-migrated')) {          // one-time move from the previous layout
      const have = new Set(list.map(ev => ev.id));
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith('sidereal2-')) continue;
        eventsFromV2(key, localStorage.getItem(key)).map(cleanEvent).filter(Boolean).forEach(ev => {
          if (!have.has(ev.id)) { list.push(ev); have.add(ev.id); }
        });
      }
      localStorage.setItem('sidereal3-migrated', '1');
      localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    }
    return list;
  }

  let events = loadEvents();
  const saveEvents = () => localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

  // ---- Where an instant sits in the calendar ---------------------------------------
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

  const planetLabel = ms => { const c = S.fromDate(new Date(ms)); return `Year ${c.year} ${S.format(c)}`; };
  const fmtDate = d => d.toLocaleDateString('en-GB');
  const fmtTime = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // =====================================================================================
  // Table
  // =====================================================================================
  function buildHeader() {
    const cols = ['<col style="width:98px">', '<col style="width:160px">'];
    let sub = '';
    for (let h = 0; h < S.HOURS_PER_DAY; h++) { cols.push('<col style="width:88px">'); sub += `<th>${pad2(h)}</th>`; }
    $('calendar-table').insertAdjacentHTML('afterbegin', `<colgroup>${cols.join('')}</colgroup>`);
    $('header-row-main').innerHTML =
      `<th rowspan="2" class="day-col">Day</th><th rowspan="2">Whole Day</th><th colspan="${S.HOURS_PER_DAY}">Hours (planet time)</th>`;
    $('header-row-sub').innerHTML = sub;
  }

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
    const year = +yearSelect.value, month = +monthSelect.value, days = monthDays(year, month);
    calendarBody.innerHTML = '';
    clearHighlights();

    for (let day = 1; day <= days; day++) {
      const doy = month * S.DAYS_PER_MONTH + day - 1;           // 0-based day of the year
      const tr = document.createElement('tr');
      tr.dataset.dayRow = day;
      tr.style.height = ROW_MIN + 'px';

      const dayTd = document.createElement('td');
      dayTd.className = 'day-number';
      if (month < RETURN_MONTH) {
        const wd = S.WEEKDAYS[(day - 1) % S.DAYS_PER_WEEK];
        dayTd.innerHTML = `<span class="dn">${day}</span><span class="wd">${wd.glyph} ${wd.name}</span>`;
        if ((day - 1) % S.DAYS_PER_WEEK === 0) tr.classList.add('week-start');
        if (doy % S.DAYS_PER_SEASON === 0) {
          tr.classList.add('season-start');
          dayTd.insertAdjacentHTML('beforeend', `<span class="season-badge">${S.SEASONS[doy / S.DAYS_PER_SEASON]}</span>`);
        }
      } else {
        dayTd.innerHTML = `<span class="dn">R${day}</span><span class="wd">Return day</span>`;
        tr.classList.add('return-row');
      }
      tr.appendChild(dayTd);

      const wholeTd = document.createElement('td');
      wholeTd.className = 'whole-day-cell';
      tr.appendChild(wholeTd);

      for (let hour = 0; hour < S.HOURS_PER_DAY; hour++) {
        const td = document.createElement('td');
        td.className = 'hour-cell';
        td.dataset.hour = hour;
        tr.appendChild(td);
      }
      calendarBody.appendChild(tr);
    }

    updateSeasonLabel();
    applyHighlights();
    renderEvents();
    markFocusRow();
  }

  // ---- Drawing the events -------------------------------------------------------------
  function renderEvents() {
    const year = +yearSelect.value, month = +monthSelect.value;
    calendarBody.querySelectorAll('.ev-bar, .allday-seg').forEach(n => n.remove());

    calendarBody.querySelectorAll('tr').forEach((tr, rowIndex) => {
      const day = +tr.dataset.dayRow;
      const ds = dayStartMs(year, month, day), de = ds + DAY_MS;

      // Whole-day events: one block in each day they cover.
      const wholeCell = tr.querySelector('.whole-day-cell');
      events.filter(e => e.type === 'days' && e.start < de && e.end > ds).forEach(e => {
        const seg = document.createElement('div');
        seg.className = `allday-seg ev-${e.color}`;
        seg.dataset.eventId = e.id;
        if (e.start >= ds) seg.classList.add('seg-first');
        if (e.end <= de) seg.classList.add('seg-last');
        if (e.start >= ds || rowIndex === 0) { seg.textContent = e.text; seg.title = e.text; }
        wholeCell.appendChild(seg);
      });

      // Hour events: bars laid across the hour columns, stacked in lanes when they overlap.
      const segs = events.filter(e => e.type === 'hours' && e.start < de && e.end > ds).map(e => {
        const s = Math.max(e.start, ds), t = Math.min(e.end, de);
        return { e, h0: Math.floor((s - ds) / HOUR_MS), n: Math.ceil((t - s) / HOUR_MS), contIn: e.start < ds, contOut: e.end > de };
      }).sort((a, b) => a.h0 - b.h0 || b.n - a.n);

      const laneEnd = [];
      segs.forEach(sg => {
        let lane = laneEnd.findIndex(end => end <= sg.h0);
        if (lane === -1) { lane = laneEnd.length; laneEnd.push(0); }
        laneEnd[lane] = sg.h0 + sg.n;

        const bar = document.createElement('div');
        bar.className = `ev-bar ev-${sg.e.color}${sg.contIn ? ' cont-in' : ''}${sg.contOut ? ' cont-out' : ''}`;
        bar.dataset.eventId = sg.e.id;
        bar.style.top = (LANE_TOP + lane * LANE_STEP) + 'px';
        bar.style.width = (sg.n * 88 - 4) + 'px';
        bar.textContent = sg.e.text;
        bar.title = sg.e.text;
        tr.querySelector(`.hour-cell[data-hour='${sg.h0}']`).appendChild(bar);
      });
      tr.style.height = Math.max(ROW_MIN, LANE_TOP + laneEnd.length * LANE_STEP + FREE_ZONE) + 'px';
    });
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
      const found = [];
      try {
        const seen = new Set();
        for (const shift of [-1, 0, 1]) {
          const t = SunCalc.getTimes(new Date(start + 12 * HOUR_MS + shift * DAY_MS), MY_LAT, MY_LONG);
          [['rise', t.sunrise], ['set', t.sunset]].forEach(([kind, d]) => {
            const ms = d.getTime();
            const key = kind + Math.round(ms / 60000);
            if (!isNaN(ms) && ms >= start && ms < start + DAY_MS && !seen.has(key)) { seen.add(key); found.push([kind, ms]); }
          });
        }
      } catch (e) { /* SunCalc not available (offline), skip the icons */ }

      tr.querySelectorAll('.hour-cell').forEach(cell => {
        const hour = +cell.dataset.hour;
        cell.classList.toggle('hour-working', overlapsWindow(hour, win));
        cell.querySelectorAll('.celestial-icon').forEach(i => i.remove());
        found.forEach(([kind, ms]) => {
          if (Math.floor((ms - start) / HOUR_MS) === hour) cell.insertAdjacentHTML('beforeend', kind === 'rise' ? SUN_ICON : MOON_ICON);
        });
      });
    });
  }

  // =====================================================================================
  // Season progress bar and the focused day
  // =====================================================================================
  let focus = (() => { const l = locate(new Date()); return { year: l.year, month: l.month, day: l.day }; })();

  function markFocusRow() {
    calendarBody.querySelectorAll('tr.focus-row').forEach(r => r.classList.remove('focus-row'));
    if (focus.year === +yearSelect.value && focus.month === +monthSelect.value) {
      const row = calendarBody.querySelector(`tr[data-day-row='${focus.day}']`);
      if (row) row.classList.add('focus-row');
    }
  }

  function updateSeasonBar() {
    const bar = $('season-bar'), fill = $('sb-fill'), marker = $('sb-marker'), ticks = $('sb-ticks');
    const { year, month, day } = focus;
    const doy = month * S.DAYS_PER_MONTH + day - 1;
    let total, pos, text, tickHtml = '';

    if (month === RETURN_MONTH) {
      total = monthDays(year, month);
      pos = day - 1;
      text = `Return days · day ${day} of ${total} · Year ${year}`;
      for (let d = 1; d < total; d++) tickHtml += `<div class="sb-tick" style="left:${(d / total) * 100}%"></div>`;
      bar.classList.add('return-bar');
    } else {
      const si = Math.floor(doy / S.DAYS_PER_SEASON), sStart = si * S.DAYS_PER_SEASON;
      total = S.DAYS_PER_SEASON;
      pos = doy - sStart;
      const wd = S.WEEKDAYS[(day - 1) % S.DAYS_PER_WEEK];
      text = `Season ${S.SEASONS[si]} · day ${pos + 1} of ${total} · ${S.MONTHS[month]} ${day} ${wd.glyph} ${wd.name} · Year ${year}`;
      // month starts inside this season
      for (let m = 0; m < RETURN_MONTH; m++) {
        const off = m * S.DAYS_PER_MONTH - sStart;
        if (off >= 0 && off < total) tickHtml += `<div class="sb-tick" style="left:${(off / total) * 100}%"><span>${S.MONTHS[m]}</span></div>`;
        else if (off < 0 && off + S.DAYS_PER_MONTH > 0) tickHtml += `<div class="sb-tick" style="left:0%;background:transparent"><span>${S.MONTHS[m]}</span></div>`;
      }
      bar.classList.remove('return-bar');
    }
    $('sb-text').textContent = text;
    ticks.innerHTML = tickHtml;
    fill.style.width = ((pos + 1) / total) * 100 + '%';
    marker.style.left = ((pos + 0.5) / total) * 100 + '%';
  }

  function setFocus(year, month, day) {
    focus = { year, month, day };
    updateSeasonBar();
    markFocusRow();
  }
  const focusHere = day => setFocus(+yearSelect.value, +monthSelect.value, day);

  // =====================================================================================
  // Clicking and dragging to add events
  // =====================================================================================
  const rowOf = el => +el.closest('tr').dataset.dayRow - 1;
  const linear = cell => rowOf(cell) * 24 + (+cell.dataset.hour);

  let sel = null, suppressClick = false;

  function paintSelection() {
    calendarBody.querySelectorAll('.sel').forEach(c => c.classList.remove('sel'));
    if (!sel) return;
    const lo = Math.min(sel.a, sel.b), hi = Math.max(sel.a, sel.b);
    if (sel.kind === 'hours') {
      calendarBody.querySelectorAll('.hour-cell').forEach(c => { const v = linear(c); if (v >= lo && v <= hi) c.classList.add('sel'); });
    } else {
      calendarBody.querySelectorAll('.whole-day-cell').forEach(c => { const v = rowOf(c); if (v >= lo && v <= hi) c.classList.add('sel'); });
    }
  }

  calendarBody.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('[data-event-id]')) return;
    const hc = e.target.closest('.hour-cell'), wc = e.target.closest('.whole-day-cell');
    if (hc) sel = { kind: 'hours', a: linear(hc), b: linear(hc) };
    else if (wc) sel = { kind: 'days', a: rowOf(wc), b: rowOf(wc) };
    paintSelection();
  });

  calendarBody.addEventListener('mouseover', e => {
    if (sel) {
      const c = e.target.closest(sel.kind === 'hours' ? '.hour-cell' : '.whole-day-cell');
      if (c) { sel.b = sel.kind === 'hours' ? linear(c) : rowOf(c); paintSelection(); }
      return;
    }
    const cell = e.target.closest('.hour-cell');
    if (cell) infoOutput.textContent = describeCell(cell);
  });

  document.addEventListener('mouseup', () => {
    if (!sel) return;
    const s = sel;
    sel = null;
    paintSelection();
    if (s.a === s.b) return;                       // a plain click is handled by the click handler below
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    const lo = Math.min(s.a, s.b), hi = Math.max(s.a, s.b);
    const year = +yearSelect.value, month = +monthSelect.value;
    if (s.kind === 'hours') {
      focusHere(Math.floor(lo / 24) + 1);
      openEditor({ type: 'hours', start: dayStartMs(year, month, 1) + lo * HOUR_MS, length: hi - lo + 1 });
    } else {
      focusHere(lo + 1);
      openEditor({ type: 'days', start: dayStartMs(year, month, lo + 1), length: hi - lo + 1 });
    }
  });

  calendarBody.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; return; }
    const year = +yearSelect.value, month = +monthSelect.value;
    const bar = e.target.closest('[data-event-id]');
    if (bar) {
      const ev = events.find(x => x.id === bar.dataset.eventId);
      if (ev) {
        focusHere(rowOf(bar) + 1);
        openEditor({ id: ev.id, type: ev.type, start: ev.start, length: (ev.end - ev.start) / (ev.type === 'days' ? DAY_MS : HOUR_MS), text: ev.text, color: ev.color });
      }
      return;
    }
    const hc = e.target.closest('.hour-cell'), wc = e.target.closest('.whole-day-cell'), dc = e.target.closest('.day-number');
    if (hc) {
      const day = rowOf(hc) + 1;
      focusHere(day);
      openEditor({ type: 'hours', start: dayStartMs(year, month, day) + (+hc.dataset.hour) * HOUR_MS, length: 1 });
    } else if (wc) {
      const day = rowOf(wc) + 1;
      focusHere(day);
      openEditor({ type: 'days', start: dayStartMs(year, month, day), length: 1 });
    } else if (dc) {
      focusHere(rowOf(dc) + 1);
    }
  });

  // ---- Showing the matching ordinary date and time on hover ---------------------------------
  function describeCell(cell) {
    const start = dayStartMs(+yearSelect.value, +monthSelect.value, rowOf(cell) + 1) + (+cell.dataset.hour) * HOUR_MS;
    const s = new Date(start), e = new Date(start + HOUR_MS);
    return `${fmtDate(s)} ${fmtTime(s)}–${fmtTime(e)} (your clock)`;
  }

  // =====================================================================================
  // Event editor
  // =====================================================================================
  const modal = $('event-modal');
  const emText = $('em-text'), emLength = $('em-length');
  let editing = null;

  const unitMs = () => editing.type === 'days' ? DAY_MS : HOUR_MS;

  function updateEditorInfo() {
    const unit = unitMs();
    const start = editing.start, end = start + editing.length * unit;
    const s = new Date(start), e = new Date(end);
    $('em-unit').textContent = editing.type === 'days' ? (editing.length === 1 ? 'day' : 'days') : (editing.length === 1 ? 'hour' : 'hours');
    document.querySelectorAll('.em-hourmove').forEach(b => { b.style.display = editing.type === 'hours' ? '' : 'none'; });

    let planet;
    if (editing.type === 'days') {
      planet = planetLabel(start) + (editing.length > 1 ? ` → ${planetLabel(end - DAY_MS)}` : '');
    } else {
      const startHour = Math.floor((start % DAY_MS) / HOUR_MS);
      const endHour = Math.floor(((end - 1) % DAY_MS) / HOUR_MS) + 1;
      const sameDay = Math.floor(start / DAY_MS) === Math.floor((end - 1) / DAY_MS);
      planet = `${planetLabel(start)} ${pad2(startHour)}:00 → ${sameDay ? '' : planetLabel(end - 1) + ' '}${pad2(endHour)}:00`;
    }
    const sameLocal = fmtDate(s) === fmtDate(e);
    $('em-planet').textContent = `Planet time: ${planet}`;
    $('em-local').textContent = `Your clock: ${fmtDate(s)} ${fmtTime(s)} → ${sameLocal ? '' : fmtDate(e) + ' '}${fmtTime(e)}`;
  }

  function openEditor(init) {
    editing = { id: init.id || null, type: init.type, start: init.start, length: Math.max(1, Math.round(init.length || 1)), color: init.color || 'green' };
    $('em-heading').textContent = editing.id ? 'Edit event' : 'New event';
    $('em-delete').style.display = editing.id ? '' : 'none';
    emText.value = init.text || '';
    emLength.value = editing.length;
    document.querySelector(`input[name='em-type'][value='${editing.type}']`).checked = true;
    document.querySelector(`input[name='em-color'][value='${editing.color}']`).checked = true;
    updateEditorInfo();
    modal.hidden = false;
    emText.focus();
  }

  function closeEditor() { modal.hidden = true; editing = null; }

  document.querySelectorAll("input[name='em-type']").forEach(r => r.addEventListener('change', () => {
    editing.type = r.value;
    if (editing.type === 'days') editing.start = Math.floor(editing.start / DAY_MS) * DAY_MS;
    updateEditorInfo();
  }));
  document.querySelectorAll("input[name='em-color']").forEach(r => r.addEventListener('change', () => { editing.color = r.value; }));
  emLength.addEventListener('input', () => {
    editing.length = Math.min(400, Math.max(1, Math.round(+emLength.value) || 1));
    updateEditorInfo();
  });
  document.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.move;
    editing.start += (m.endsWith('h') ? HOUR_MS : DAY_MS) * (m.startsWith('-') ? -1 : 1);
    updateEditorInfo();
  }));

  function saveEditor() {
    const text = emText.value.trim();
    if (!text) { emText.focus(); return; }
    const unit = unitMs();
    const ev = cleanEvent({ id: editing.id || newId(), type: editing.type, start: editing.start, end: editing.start + editing.length * unit, text, color: editing.color });
    if (!ev) return;
    const i = events.findIndex(x => x.id === ev.id);
    if (i >= 0) events[i] = ev; else events.push(ev);
    saveEvents();
    closeEditor();
    renderEvents();
  }

  $('em-save').addEventListener('click', saveEditor);
  $('em-cancel').addEventListener('click', closeEditor);
  $('em-delete').addEventListener('click', () => {
    if (!editing || !editing.id) return;
    if (!confirm('Delete this event?')) return;
    events = events.filter(x => x.id !== editing.id);
    saveEvents();
    closeEditor();
    renderEvents();
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });
  document.addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeEditor();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEditor();
  });

  // =====================================================================================
  // Today, Go to, and moving between months
  // =====================================================================================
  let currentHighlight = null;

  function clearHighlights() {
    if (currentHighlight) {
      currentHighlight.row.classList.remove('today-highlight');
      if (currentHighlight.cell) currentHighlight.cell.classList.remove('today-highlight-hour');
      currentHighlight = null;
    }
  }

  // Shows the month holding `loc` and highlights its day (and hour, when given).
  function showLocation(loc, withHour) {
    yearSelect.value = loc.year;
    monthSelect.value = loc.month;
    createCalendar();
    const row = calendarBody.querySelector(`tr[data-day-row='${loc.day}']`);
    if (!row) return;
    const cell = withHour ? row.querySelector(`.hour-cell[data-hour='${loc.hour}']`) : null;
    row.classList.add('today-highlight');
    if (cell) cell.classList.add('today-highlight-hour');
    currentHighlight = { row, cell };
    setFocus(loc.year, loc.month, loc.day);
    (cell || row).scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  $('today-btn').addEventListener('click', () => showLocation(locate(new Date()), true));

  // The form makes the Enter key work the same as clicking Go.
  $('goto-form').addEventListener('submit', e => {
    e.preventDefault();
    const m = $('date-input').value.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m) { infoOutput.textContent = 'Use DD/MM/YYYY'; return; }
    const date = new Date(+m[3], +m[2] - 1, +m[1], 12, 0);        // midday on that date, on your clock
    if (isNaN(date.getTime()) || date.getDate() !== +m[1]) { infoOutput.textContent = 'That date does not exist.'; return; }
    const loc = locate(date);
    if (loc.year < 0 || loc.year > MAX_YEAR) { infoOutput.textContent = `This calendar covers years 0 to ${MAX_YEAR} (April 2000 onwards).`; return; }
    showLocation(loc, false);
    const c = loc.cal;
    infoOutput.textContent = `Year ${c.year}, ${S.format(c)}`;
  });

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

  // =====================================================================================
  // Location button and work zone picker
  // =====================================================================================
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

  // Changes made in the clock, or in another tab of this calendar, show up here too.
  window.addEventListener('storage', e => {
    if (e.key === 'user_lat') MY_LAT = parseFloat(e.newValue) || 51.5074;
    if (e.key === 'user_long') MY_LONG = parseFloat(e.newValue) || -0.1278;
    if (e.key === 'work_zone') $('work-zone').value = e.newValue || '';
    if (e.key === 'work_follow_dst') { $('follow-dst').checked = e.newValue === 'true'; refreshZoneLabels(); }
    if (['user_lat', 'user_long', 'work_zone', 'work_follow_dst'].includes(e.key)) { updateLocationUI(); applyHighlights(); }
    if (e.key === EVENTS_KEY) { events = loadEvents(); renderEvents(); }
  });

  // =====================================================================================
  // Export and import. Importing only ADDS events this calendar doesn't have yet:
  // anything already here (same event id) is left exactly as it is.
  // =====================================================================================
  function exportData() {
    const file = { app: 'sidereal-calendar', version: 3, exported: new Date().toISOString(), events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sidereal-calendar-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        let incoming = [], legacy = 0;
        if (Array.isArray(data.events)) incoming = data.events;
        else for (const key in data) {                         // export files from the previous version
          if (key.startsWith('sidereal2-')) incoming = incoming.concat(eventsFromV2(key, data[key]));
          else if (key.startsWith('sidereal-calendar-')) legacy++;
        }
        const have = new Set(events.map(ev => ev.id));
        let added = 0, already = 0, unusable = 0;
        incoming.forEach(raw => {
          const ev = cleanEvent(raw);
          if (!ev) { unusable++; return; }
          if (have.has(ev.id)) { already++; return; }
          events.push(ev); have.add(ev.id); added++;
        });
        saveEvents();
        renderEvents();
        let msg = `Added ${added} new event${added === 1 ? '' : 's'}. ${already} already in your calendar (left unchanged).`;
        if (unusable) msg += ` ${unusable} could not be read.`;
        if (legacy) msg += ` ${legacy} month(s) from the old 50-day layout were skipped, as they can't be converted.`;
        alert(msg);
      } catch (err) {
        alert('Error importing file. Please make sure it is a calendar export (.json).');
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
  createCalendar();
  updateSeasonBar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered for Calendar'))
      .catch(error => console.error('Service Worker Registration Failed:', error));
  }
});
