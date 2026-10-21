/*
 * rooms.js: shared "rooms" for the Sidereal Calendar.
 *
 * ROOMS_MODE below chooses how rooms work:
 *   'off'       No rooms. The calendar is personal and local only. (default)
 *   'practice'  A pretend room server kept inside this browser, for testing: open the
 *               calendar in two tabs, join the same room in both, and edits show up live.
 *               You can also try it without editing anything by adding ?rooms=practice
 *               to the end of the page address.
 *   'supabase'  The real shared rooms. Needs a Supabase project (fill in the three
 *               settings below).
 *
 * The calendar only ever talks to SiderealRooms, so switching mode never touches
 * the rest of the code.
 */
(function (root) {
  'use strict';

  // ---- Settings ---------------------------------------------------------
  const ROOMS_MODE = 'off';                                   // 'off' | 'practice' | 'supabase'

  const SUPABASE_URL = 'PASTE-YOUR-PROJECT-URL-HERE';
  const SUPABASE_ANON_KEY = 'PASTE-YOUR-ANON-KEY-HERE';
  const SUPABASE_TABLE = 'shared_calendar_cells_v2';          // columns: room_id, year, month, day, hour, content, updated_at
  const SUPABASE_PASSWORD_CHECK = 'verify_room_password';     // function(target_room_id, target_password) -> true/false
  const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  // ---- Which mode is running ------------------------------------------------
  const asked = new URLSearchParams(root.location ? root.location.search : '').get('rooms');
  const mode = (asked === 'practice' || asked === 'off') ? asked : ROOMS_MODE;

  const listeners = [];
  const emit = cell => listeners.forEach(fn => fn(cell));

  // A cell is identified by: year, month (0-9, or 10 for the Return days), day, hour (0-23).

  // ---- Practice backend (this browser only) ------------------------------------
  const practice = (function () {
    const ROOMS_KEY = 'practice-rooms';
    const DATA_KEY = 'practice-room-data:';
    const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sidereal-practice-rooms') : null;
    let room = null;

    const delay = ms => new Promise(r => setTimeout(r, ms));
    const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (e) { return fallback; } };
    const hash = s => { let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return String(h >>> 0); };

    if (chan) chan.onmessage = e => { if (e.data && e.data.room === room) emit(e.data.cell); };

    return {
      label: 'Practice room (this browser only)',
      // The first password used for a new room name becomes that room's password.
      async join(name, password) {
        await delay(120);
        const rooms = read(ROOMS_KEY, {});
        if (!rooms[name]) {
          rooms[name] = { pw: hash(password) };
          localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
          room = name;
          return { ok: true, created: true };
        }
        if (rooms[name].pw !== hash(password)) return { ok: false, reason: 'bad-credentials' };
        room = name;
        return { ok: true };
      },
      async loadMonth(year, month) {
        await delay(60);
        const data = read(DATA_KEY + room, {});
        return Object.keys(data)
          .filter(k => k.startsWith(`${year}|${month}|`))
          .map(k => { const p = k.split('|'); return { day: +p[2], hour: +p[3], content: data[k].content }; });
      },
      async saveCell(c) {
        await delay(60);
        const data = read(DATA_KEY + room, {});
        const key = `${c.year}|${c.month}|${c.day}|${c.hour}`;
        if (c.content) data[key] = { content: c.content }; else delete data[key];
        localStorage.setItem(DATA_KEY + room, JSON.stringify(data));
        if (chan) chan.postMessage({ room, cell: c });
        return { ok: true };
      },
      leave() { room = null; }
    };
  })();

  // ---- Supabase backend (the real thing) --------------------------------------
  const supa = (function () {
    let client = null, channel = null, room = null;

    function loadLibrary() {
      return new Promise((resolve, reject) => {
        if (root.supabase) return resolve();
        const s = document.createElement('script');
        s.src = SUPABASE_LIB;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load the Supabase library.'));
        document.head.appendChild(s);
      });
    }
    async function ready() {
      if (client) return;
      await loadLibrary();
      client = root.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    return {
      label: 'Shared room',
      async join(name, password) {
        try {
          await ready();
          const { data, error } = await client.rpc(SUPABASE_PASSWORD_CHECK, { target_room_id: name, target_password: password });
          if (error) return { ok: false, reason: 'error', message: error.message };
          if (!data) return { ok: false, reason: 'bad-credentials' };
          room = name;
          if (channel) client.removeChannel(channel);
          channel = client.channel(`calendar-${name}`)
            .on('postgres_changes',
              { event: '*', schema: 'public', table: SUPABASE_TABLE, filter: `room_id=eq.${name}` },
              p => {
                const gone = !p.new || Object.keys(p.new).length === 0;
                const r = gone ? p.old : p.new;
                if (r) emit({ year: r.year, month: r.month, day: r.day, hour: r.hour, content: gone ? '' : (r.content || '') });
              })
            .subscribe();
          return { ok: true };
        } catch (e) {
          return { ok: false, reason: 'error', message: e.message };
        }
      },
      async loadMonth(year, month) {
        const { data, error } = await client.from(SUPABASE_TABLE)
          .select('day,hour,content').eq('room_id', room).eq('year', year).eq('month', month);
        if (error) throw error;
        return data;
      },
      async saveCell(c) {
        const { error } = await client.from(SUPABASE_TABLE).upsert(
          { room_id: room, year: c.year, month: c.month, day: c.day, hour: c.hour, content: c.content, updated_at: new Date().toISOString() },
          { onConflict: 'room_id,year,month,day,hour' });
        return { ok: !error, message: error && error.message };
      },
      leave() { if (channel && client) client.removeChannel(channel); channel = null; room = null; }
    };
  })();

  // ---- What the calendar uses ----------------------------------------------------
  const backend = mode === 'practice' ? practice : mode === 'supabase' ? supa : null;

  root.SiderealRooms = {
    mode,
    enabled: !!backend,
    label: backend ? backend.label : '',
    join: (name, password) => backend.join(name, password),
    loadMonth: (year, month) => backend.loadMonth(year, month),
    saveCell: cell => backend.saveCell(cell),
    leave: () => { if (backend) backend.leave(); },
    onChange: fn => { listeners.push(fn); }
  };
})(typeof self !== 'undefined' ? self : this);
