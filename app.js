document.addEventListener("DOMContentLoaded", function () {
  // --- Supabase Setup ---
  const SUPABASE_URL = "https://ujtmiyulcclmusybuycx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdG1peXVsY2NsbXVzeWJ1eWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjY1NTksImV4cCI6MjA5OTcwMjU1OX0.qugwR9JuLh1nfLCKODrmKkrB-oZ82RMyG1slW9Sfp4s";
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  let currentRoom = null;
  let supabaseSubscription = null;

  // --- DOM Elements ---
  const calendarBody = document.getElementById("calendar-body");
  const todayBtn = document.getElementById("today-btn");
  const yearSelect = document.getElementById("year-select");
  const seasonSelect = document.getElementById("season-select");
  const monthSelect = document.getElementById("month-select");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const fileInput = document.getElementById("file-input");

  // Room UI Elements
  const roomInput = document.getElementById("room-input");
  const joinRoomBtn = document.getElementById("join-room-btn");
  const roomStatus = document.getElementById("room-status");

  // Location UI Elements
  const locationBtn = document.getElementById("location-btn");
  const locationDisplay = document.getElementById("location-display");

  // --- Calendar & Clock Constants ---
  const DAYS_IN_MONTH = 50;
  const NARES_PER_DAY = 10;
  const SIDEREAL_YEAR_SECS = (365 * 86400) + (5 * 3600) + (48 * 60) + 45;
  const EPOCH = new Date('2000-01-01T00:00:00.000Z'); 
  const DAYS_IN_YEAR = 1000;
  const MONTHS_PER_SEASON = 5;
  const PINGS_PER_SEC = 10;
  const SECS_PER_DIN = 10;
  const DINS_PER_NARE = 50;
  const PING_LENGTH = SIDEREAL_YEAR_SECS / (DAYS_IN_YEAR * NARES_PER_DAY * DINS_PER_NARE * SECS_PER_DIN * PINGS_PER_SEC);
  const SECONDS_PER_NARE_REAL = SIDEREAL_YEAR_SECS / (DAYS_IN_YEAR * NARES_PER_DAY);

  // --- Dynamic Location Coordinates ---
  let MY_LAT = parseFloat(localStorage.getItem('user_lat')) || 51.5074; 
  let MY_LONG = parseFloat(localStorage.getItem('user_long')) || -0.1278;

  function updateLocationUI() {
    if (locationDisplay) {
      const latStr = `${Math.abs(MY_LAT).toFixed(2)}° ${MY_LAT >= 0 ? 'N' : 'S'}`;
      const longStr = `${Math.abs(MY_LONG).toFixed(2)}° ${MY_LONG >= 0 ? 'E' : 'W'}`;
      locationDisplay.textContent = `${latStr}, ${longStr}`;
    }
  }

  function updateLocation(lat, long) {
    MY_LAT = parseFloat(lat);
    MY_LONG = parseFloat(long);
    localStorage.setItem('user_lat', MY_LAT);
    localStorage.setItem('user_long', MY_LONG);
    updateLocationUI();
    highlightWorkingHours(); 
  }

  const SUN_ICON = `<svg class="celestial-icon" viewBox="0 0 24 24" fill="orange" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg>`;
  const MOON_ICON = `<svg class="celestial-icon" viewBox="0 0 24 24" fill="#4a5568" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const datetimeInput = document.getElementById("datetime-input");
  const goToBtn = document.getElementById("go-to-btn");
  const nareDisplayOutput = document.getElementById("nare-display-output");
  let isLocked = false;
  let currentHighlight = null;

  function getSiderealDateFromGregorian(gregorianDate) {
    if (gregorianDate.getTime() < EPOCH.getTime()) {
      console.error("Date is before J2000 epoch. Cannot convert.");
      return null;
    }

    const elapsed = (gregorianDate.getTime() - EPOCH.getTime()) / 1000; 
    const totalPings = elapsed / PING_LENGTH;
    const totalNares = totalPings / (PINGS_PER_SEC * SECS_PER_DIN * DINS_PER_NARE);
    const totalDays = Math.floor(totalNares / NARES_PER_DAY);

    const siderealYear = Math.floor(elapsed / SIDEREAL_YEAR_SECS);
    const dayOfYear = totalDays % DAYS_IN_YEAR;

    const daysPerSeason = DAYS_IN_MONTH * MONTHS_PER_SEASON;
    const seasonIndex = Math.floor(dayOfYear / daysPerSeason);
    const dayInSeason = dayOfYear % daysPerSeason;

    const monthIndex = Math.floor(dayInSeason / DAYS_IN_MONTH);
    const dayInMonth = (dayInSeason % DAYS_IN_MONTH) + 1; 
    const nareOfDay = Math.floor(totalNares % NARES_PER_DAY) + 1; 

    return {
      year: siderealYear,
      season: seasonIndex,
      month: monthIndex,
      day: dayInMonth,
      nare: nareOfDay
    };
  }

  function handleNareContentClick(event) {
      isLocked = true; 
      const pane = event.target;
      const nareCell = pane.closest('.nare-cell');
      const day = parseInt(nareCell.dataset.day);
      const nare = parseInt(nareCell.dataset.nare);

      const siderealYear = parseInt(yearSelect.value);
      const seasonIndex = parseInt(seasonSelect.value);
      const monthIndex = parseInt(monthSelect.value);

      const gregorianDate = getGregorianDateFromSidereal(siderealYear, seasonIndex, monthIndex, day, nare);

      const formattedDate = gregorianDate.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const formattedTime = gregorianDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false 
      });

      nareDisplayOutput.textContent = `${formattedDate} ${formattedTime}`;
  }

  document.addEventListener('click', (e) => {
    if (
      !e.target.closest('.nare-cell') &&
      !e.target.closest('#calendar-body') &&
      !e.target.closest('#nare-display-output')
    ) {
      isLocked = false;
      nareDisplayOutput.textContent = "Click an Hour box";
    }
  });

  function clearTargetHighlights() {
    if (currentHighlight) {
      currentHighlight.row.classList.remove('today-highlight');
      currentHighlight.nareCell.classList.remove('today-highlight-nare');
      currentHighlight = null;
    }
  }

  function executeGoToDate() {
    const inputString = datetimeInput.value.trim();
    if (!inputString) {
      nareDisplayOutput.textContent = "Please enter a date and time.";
      return;
    }

    const [datePart, timePart] = inputString.split(' ');
    
    if (!datePart || !timePart) {
      nareDisplayOutput.textContent = "Invalid format. Use DD/MM/YYYY HH:MM";
      return;
    }

    const [day, month, year] = datePart.split('/').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    const gregorianInputDate = new Date(year, month - 1, day, hours, minutes);
    gregorianInputDate.setMinutes(gregorianInputDate.getMinutes() + 1);

    if (isNaN(gregorianInputDate.getTime())) {
      nareDisplayOutput.textContent = "Invalid date/time entered.";
      return;
    }

    if (gregorianInputDate.getTime() < EPOCH.getTime()) {
      nareDisplayOutput.textContent = "Date must be after J2000 epoch (2000-01-01 00:00:00 UTC).";
      return;
    }

    const siderealTarget = getSiderealDateFromGregorian(gregorianInputDate);

    if (siderealTarget) {
      clearTargetHighlights();

      yearSelect.value = siderealTarget.year;
      seasonSelect.value = siderealTarget.season;
      monthSelect.value = siderealTarget.month;

      createCalendar();

      setTimeout(() => {
        const targetCell = document.querySelector(
          `.nare-cell[data-day="${siderealTarget.day}"][data-nare="${siderealTarget.nare}"]`
        );
        const targetRow = calendarBody.querySelector(`tr[data-day-row='${siderealTarget.day}']`);

        if (targetCell && targetRow) {
          targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          targetRow.classList.add('today-highlight');
          targetCell.classList.add('today-highlight-nare');
          
          currentHighlight = { row: targetRow, nareCell: targetCell };

          const localPane = targetCell.querySelector('.nare-pane-local');
          if (localPane) localPane.focus();
  
          const seasonNames = ["Α (Alpha)", "Β (Beta)", "Γ (Gamma)", "Δ (Delta)"];
          const currentSeasonName = seasonNames[siderealTarget.season] || (siderealTarget.season + 1);

          nareDisplayOutput.textContent = `Mapped to Year ${siderealTarget.year}, Season ${currentSeasonName}, Month ${siderealTarget.month+1}, Day ${siderealTarget.day}, Hour ${siderealTarget.nare}`;
        }
      }, 100); 
    } else {
      nareDisplayOutput.textContent = "Error converting date.";
    }
  }

  goToBtn.addEventListener('click', executeGoToDate);

  datetimeInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      executeGoToDate();
    }
  });

  function getSiderealDate() {
    const elapsed = (Date.now() - EPOCH.getTime()) / 1000; 
    const totalPings = elapsed / PING_LENGTH;
    const totalNares = totalPings / (PINGS_PER_SEC * SECS_PER_DIN * DINS_PER_NARE);
    const totalDays = Math.floor(totalNares / NARES_PER_DAY);
    const siderealYear = Math.floor(elapsed / SIDEREAL_YEAR_SECS);
    const dayOfYear = totalDays % DAYS_IN_YEAR;
    const daysPerSeason = DAYS_IN_MONTH * MONTHS_PER_SEASON;
    const seasonIndex = Math.floor(dayOfYear / daysPerSeason);
    const dayInSeason = dayOfYear % daysPerSeason;
    const monthIndex = Math.floor(dayInSeason / DAYS_IN_MONTH);
    const dayInMonth = (dayInSeason % DAYS_IN_MONTH) + 1;
    const nareOfDay = Math.floor(totalNares % NARES_PER_DAY) + 1; 

    return { year: siderealYear, season: seasonIndex, month: monthIndex, day: dayInMonth, nare: nareOfDay };
  }

  function getGregorianDateFromSidereal(siderealYear, seasonIndex, monthIndex, dayInMonth, nareNumber) {
      const daysPerSeason = DAYS_IN_MONTH * MONTHS_PER_SEASON;
      const totalSiderealDaysFromEpoch = 
          (siderealYear * DAYS_IN_YEAR) + 
          (seasonIndex * daysPerSeason) + 
          (monthIndex * DAYS_IN_MONTH) + 
          (dayInMonth - 1); 

      const totalNaresFromEpoch = (totalSiderealDaysFromEpoch * NARES_PER_DAY) + (nareNumber - 1); 
      const elapsedRealSeconds = totalNaresFromEpoch * SECONDS_PER_NARE_REAL;

      return new Date(EPOCH.getTime() + (elapsedRealSeconds * 1000));
  }

  const debounce = (func, delay) => {
      let timeoutId;
      return (...args) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
              func.apply(this, args);
          }, delay);
      };
  };
  const debouncedSaveData = debounce(saveData, 500);
  
  function getStorageKey() {
    return `sidereal-calendar-${yearSelect.value}-${seasonSelect.value}-${monthSelect.value}`;
  }

  function saveData() {
    const key = getStorageKey();
    const data = {
      wholeDay: {},
      nares: {}
    };
    const rows = calendarBody.querySelectorAll('tr');
    rows.forEach((row, dayIndex) => {
      const day = dayIndex + 1;
      const wholeDayContent = row.querySelector('.whole-day-content');
      if (wholeDayContent && wholeDayContent.innerHTML) {
        data.wholeDay[day] = wholeDayContent.innerHTML;
      }

      const nareCells = row.querySelectorAll('.nare-cell');
      nareCells.forEach(cell => {
        const nare = cell.dataset.nare;
        const localPane = cell.querySelector('.nare-pane-local');
        const content = localPane ? localPane.innerHTML : '';
        if (content) { 
          if (!data.nares[day]) data.nares[day] = {};
          data.nares[day][nare] = { content };
        }
      });
    });
    localStorage.setItem(key, JSON.stringify(data));
  }

  function loadData() {
    const key = getStorageKey();
    const data = JSON.parse(localStorage.getItem(key));
    
    const allNareCells = calendarBody.querySelectorAll('.nare-cell');
    allNareCells.forEach(cell => {
        const localPane = cell.querySelector('.nare-pane-local');
        if (localPane) localPane.innerHTML = ''; 
    });

    if (!data) return;

    for (const day in data.wholeDay) {
      const cell = calendarBody.querySelector(`tr:nth-child(${day}) .whole-day-content`);
      if (cell) cell.innerHTML = data.wholeDay[day];
    }

    for (const day in data.nares) {
      for (const nare in data.nares[day]) {
        const cellData = data.nares[day][nare];
        const cell = calendarBody.querySelector(`.nare-cell[data-day='${day}'][data-nare='${nare}']`);
        if (!cell) continue;

        const localPane = cell.querySelector('.nare-pane-local');
        if (localPane) {
          localPane.innerHTML = (cellData && typeof cellData === 'object' ? cellData.content : cellData) || '';
        }
      }
    }
  }
  
  function createCalendar() {
    calendarBody.innerHTML = ''; 
    for (let day = 1; day <= DAYS_IN_MONTH; day++) {
      const tr = document.createElement("tr");
      tr.dataset.dayRow = day;

      const dayTd = document.createElement("td");
      dayTd.className = "day-number";
      dayTd.textContent = day;
      tr.appendChild(dayTd);

      const wholeDayTd = document.createElement("td");
      wholeDayTd.className = "whole-day-cell";
      const wholeContent = document.createElement("div");
      wholeContent.contentEditable = true;
      wholeContent.className = "whole-day-content";
      wholeContent.addEventListener('input', debouncedSaveData);
      wholeDayTd.appendChild(wholeContent);
      tr.appendChild(wholeDayTd);

      for (let i = 1; i <= NARES_PER_DAY; i++) {
        const td = document.createElement("td");
        td.className = "nare-cell";
        td.dataset.day = day;
        td.dataset.nare = i;

        const dualContainer = document.createElement("div");
        dualContainer.className = "nare-dual-container";

        const localPane = document.createElement("div");
        localPane.className = "nare-pane-local";
        localPane.contentEditable = true;
        localPane.placeholder = "Local...";
        localPane.addEventListener('input', debouncedSaveData);
        localPane.addEventListener('click', handleNareContentClick);

        const sharedPane = document.createElement("div");
        sharedPane.className = "nare-pane-shared";
        sharedPane.dataset.day = day;
        sharedPane.dataset.nare = i;

        if (currentRoom) {
          sharedPane.contentEditable = true;
          sharedPane.placeholder = "Shared...";
          sharedPane.classList.add("connected");
          sharedPane.addEventListener('input', (e) => debouncedSaveSharedData(e, day, i));
        } else {
          sharedPane.contentEditable = false; 
          sharedPane.placeholder = "Shared (Offline)...";
          sharedPane.classList.remove("connected");
        }
        sharedPane.addEventListener('click', handleNareContentClick);

        dualContainer.appendChild(localPane);
        dualContainer.appendChild(sharedPane);
        td.appendChild(dualContainer);

        tr.appendChild(td);
      }
      
      calendarBody.appendChild(tr);
    }
    loadData(); 
    highlightWorkingHours(); 
    if (currentRoom) {
      loadSharedData();
    }
  }

  // --- Shared Supabase Logic ---

  async function handleRoomConnection() {
    const roomName = roomInput.value.trim().toLowerCase();
    const roomPassword = document.getElementById("room-password-input").value.trim();
    
    if (!roomName || !roomPassword) {
      alert("Please enter both Room Name and Password.");
      return;
    }

    roomStatus.textContent = `Verifying credentials...`;
    roomStatus.style.color = "#df8a14";

    const { data: isValid, error: roomError } = await supabase
      .rpc('verify_room_password', {
        target_room_id: roomName,
        target_password: roomPassword
      });

    if (roomError) {
      console.error("Verification error:", roomError);
      alert("An error occurred during verification.");
      roomStatus.textContent = "Offline Mode";
      roomStatus.style.color = "#718096";
      return;
    }

    if (!isValid) {
      alert("Incorrect Room Name or Password.");
      roomStatus.textContent = "Offline Mode";
      roomStatus.style.color = "#718096";
      return;
    }

    currentRoom = roomName;
    roomStatus.textContent = `Connecting to [${currentRoom.toUpperCase()}]...`;
    roomStatus.style.color = "#3b82f6";

    if (supabaseSubscription) {
      supabase.removeChannel(supabaseSubscription);
    }

    createCalendar();
    await loadSharedData();

    supabaseSubscription = supabase
      .channel('public:shared_calendar_cells')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_calendar_cells',
          filter: `room_id=eq.${currentRoom}`
        },
        (payload) => {
          handleIncomingRealtimePayload(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          roomStatus.textContent = `Connected: ${currentRoom.toUpperCase()}`;
          roomStatus.style.color = "#10b981";
        }
      });
  }  
  async function loadSharedData() {
    if (!currentRoom || !supabase) return;

    const currentYear = parseInt(yearSelect.value);
    const currentSeason = parseInt(seasonSelect.value);
    const currentMonth = parseInt(monthSelect.value);

    const { data, error } = await supabase
      .from('shared_calendar_cells')
      .select('*')
      .eq('room_id', currentRoom)
      .eq('year', currentYear)
      .eq('season', currentSeason)
      .eq('month', currentMonth);

    if (error) {
      console.error("Error loading shared data:", error);
      return;
    }

    document.querySelectorAll('.nare-pane-shared').forEach(pane => {
      pane.innerHTML = '';
    });

    data.forEach(row => {
      const sharedPane = document.querySelector(`.nare-pane-shared[data-day="${row.day}"][data-nare="${row.nare}"]`);
      if (sharedPane) {
        sharedPane.innerHTML = row.content || '';
      }
    });
  }

  const debouncedSaveSharedData = debounce(async (event, day, nare) => {
    if (!currentRoom || !supabase) return;

    const content = event.target.innerHTML;
    const year = parseInt(yearSelect.value);
    const season = parseInt(seasonSelect.value);
    const month = parseInt(monthSelect.value);

    const { error } = await supabase
      .from('shared_calendar_cells')
      .upsert({
        room_id: currentRoom,
        year: year,
        season: season,
        month: month,
        day: day,
        nare: nare,
        content: content,
        updated_at: new Date().toISOString()
      }, { onConflict: 'room_id,year,season,month,day,nare' });

    if (error) {
      console.error("Error saving shared cell:", error);
    }
  }, 500);

  function handleIncomingRealtimePayload(payload) {
    const newRecord = payload.new;
    const oldRecord = payload.old;

    const targetRecord = newRecord && Object.keys(newRecord).length > 0 ? newRecord : oldRecord;
    if (!targetRecord) return;

    if (
      targetRecord.year !== parseInt(yearSelect.value) ||
      targetRecord.season !== parseInt(seasonSelect.value) ||
      targetRecord.month !== parseInt(monthSelect.value)
    ) {
      return; 
    }

    const sharedPane = document.querySelector(`.nare-pane-shared[data-day="${targetRecord.day}"][data-nare="${targetRecord.nare}"]`);
    if (sharedPane) {
      if (document.activeElement !== sharedPane) {
        sharedPane.innerHTML = targetRecord.content || '';
      }
    }
  }

  joinRoomBtn.addEventListener("click", handleRoomConnection);
  roomInput.addEventListener("keydown", (e) => {
    if (e.key === 'Enter') {
      handleRoomConnection();
    }
  });

  // --- End Shared Supabase Logic ---

  function highlightWorkingHours() {
      const rows = calendarBody.querySelectorAll('tr');
      const currentSiderealYear = parseInt(yearSelect.value);
      const currentSeasonIndex = parseInt(seasonSelect.value);
      const currentMonthIndex = parseInt(monthSelect.value);

      rows.forEach(row => {
          const siderealDayInMonth = parseInt(row.dataset.dayRow);
          const nareCells = row.querySelectorAll('.nare-cell');

          const midDayGregorian = getGregorianDateFromSidereal(
              currentSiderealYear,
              currentSeasonIndex,
              currentMonthIndex,
              siderealDayInMonth,
              5 
          );

          const sunTimes = SunCalc.getTimes(midDayGregorian, MY_LAT, MY_LONG);
          const sunriseTime = sunTimes.sunrise.getTime();
          const sunsetTime = sunTimes.sunset.getTime();

          nareCells.forEach(cell => {
              cell.classList.remove('nare-working-hours');
              
              const existingIcon = cell.querySelector('.celestial-icon');
              if (existingIcon) existingIcon.remove();

              const nareNumber = parseInt(cell.dataset.nare); 

              const gregorianNareStart = getGregorianDateFromSidereal(
                  currentSiderealYear,
                  currentSeasonIndex,
                  currentMonthIndex,
                  siderealDayInMonth,
                  nareNumber
              );
              const nareStartTime = gregorianNareStart.getTime();
              const nareEndTime = nareStartTime + (SECONDS_PER_NARE_REAL * 1000);

              const nareLocalYear = gregorianNareStart.getFullYear();
              const nareLocalMonth = gregorianNareStart.getMonth();
              const nareLocalDay = gregorianNareStart.getDate();
              const workingHoursStart = new Date(nareLocalYear, nareLocalMonth, nareLocalDay, 9, 0, 0).getTime();
              const workingHoursEnd = new Date(nareLocalYear, nareLocalMonth, nareLocalDay, 17, 0, 0).getTime();

              const isWorkingHours = (nareEndTime > workingHoursStart) && (nareStartTime < workingHoursEnd);
              if (isWorkingHours) {
                  cell.classList.add('nare-working-hours');
              }
              
              if (sunriseTime >= nareStartTime && sunriseTime < nareEndTime) {
                  cell.insertAdjacentHTML('beforeend', SUN_ICON);
              }

              if (sunsetTime >= nareStartTime && sunsetTime < nareEndTime) {
                  cell.insertAdjacentHTML('beforeend', MOON_ICON);
              }
          });
      });
  }

  function handleDropdownChange() {
    createCalendar(); 
  }

  calendarBody.addEventListener('mouseover', (e) => {
      if (isLocked) return; 
      const targetCell = e.target.closest('.nare-cell');
      if (!targetCell) return;

      const siderealYear = parseInt(yearSelect.value);
      const seasonIndex = parseInt(seasonSelect.value);
      const monthIndex = parseInt(monthSelect.value);
      const siderealDayInMonth = parseInt(targetCell.dataset.day);
      const nareNumber = parseInt(targetCell.dataset.nare);

      const gregorianNareStart = getGregorianDateFromSidereal(
          siderealYear,
          seasonIndex,
          monthIndex,
          siderealDayInMonth,
          nareNumber
      );
      const gregorianNareEnd = new Date(gregorianNareStart.getTime() + (SECONDS_PER_NARE_REAL * 1000));
      
      nareDisplayOutput.textContent = `${gregorianNareStart.toLocaleDateString()} ${gregorianNareStart.toLocaleTimeString()} to ${gregorianNareEnd.toLocaleTimeString()}`;
  });

  todayBtn.addEventListener("click", () => {
    const today = getSiderealDate();
    
    yearSelect.value = today.year;
    seasonSelect.value = today.season;
    monthSelect.value = today.month;
    
    createCalendar(); 
    clearTargetHighlights();
    
    const todayRow = calendarBody.querySelector(`tr[data-day-row='${today.day}']`);
    const todayNareCell = todayRow ? todayRow.querySelector(`.nare-cell[data-day='${today.day}'][data-nare='${today.nare}']`) : null;

    if (todayRow && todayNareCell) {
        todayRow.classList.add('today-highlight');
        todayNareCell.classList.add('today-highlight-nare');
        todayNareCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
        currentHighlight = { row: todayRow, nareCell: todayNareCell };
    }
  });

  // --- Dynamic Location Events ---
  if (locationBtn) {
    locationBtn.addEventListener("click", () => {
      if ("geolocation" in navigator) {
        locationDisplay.textContent = "Detecting...";
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const long = position.coords.longitude;
            updateLocation(lat, long);
          },
          (error) => {
            const manualCoords = prompt(
              "GPS Blocked/Unavailable.\nEnter location manually as 'latitude, longitude'\n(Example: 51.51, -0.13 for London)\n\nLook up decimal values on latlong.net."
            );
            if (manualCoords) {
              const parts = manualCoords.split(',');
              if (parts.length === 2) {
                const lat = parseFloat(parts[0].trim());
                const long = parseFloat(parts[1].trim());
                if (!isNaN(lat) && !isNaN(long)) {
                  updateLocation(lat, long);
                } else {
                  alert("Invalid numbers entered.");
                  updateLocationUI();
                }
              } else {
                alert("Incorrect format. Please use 'latitude, longitude'.");
                updateLocationUI();
              }
            } else {
              updateLocationUI();
            }
          }
        );
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    });
  }

  function populateSelects() {
      for (let y = 0; y <= 100; y++) {
        const opt = document.createElement("option");
        opt.value = y; opt.textContent = y;
        yearSelect.appendChild(opt);
      }
      ["Α (Alpha)", "Β (Beta)", "Γ (Gamma)", "Δ (Delta)"].forEach((s, i) => {
        const opt = document.createElement("option");
        opt.value = i; opt.textContent = s;
        seasonSelect.appendChild(opt);
      });
      ["I", "II", "III", "IV", "V"].forEach((m, i) => {
        const opt = document.createElement("option");
        opt.value = i; opt.textContent = m;
        monthSelect.appendChild(opt);
      });
      
      const today = getSiderealDate();
      yearSelect.value = today.year;
      seasonSelect.value = today.season;
      monthSelect.value = today.month;

      yearSelect.addEventListener('change', handleDropdownChange);
      seasonSelect.addEventListener('change', handleDropdownChange);
      monthSelect.addEventListener('change', handleDropdownChange);

      const prevBtn = document.getElementById("prev-month-btn");
      const nextBtn = document.getElementById("next-month-btn");

      nextBtn.addEventListener("click", () => {
        let currentMonth = parseInt(monthSelect.value);
        let currentSeason = parseInt(seasonSelect.value);
        let currentYear = parseInt(yearSelect.value);

        currentMonth++; 

        if (currentMonth > 4) { 
          currentMonth = 0;    
          currentSeason++;     

          if (currentSeason > 3) { 
            currentSeason = 0;     
            currentYear++;         

            if (currentYear > 100) {
              currentYear = 100; 
              currentSeason = 3; 
              currentMonth = 4;
              return; 
            }
          }
        }

        yearSelect.value = currentYear;
        seasonSelect.value = currentSeason;
        monthSelect.value = currentMonth;
        createCalendar();
      });

      prevBtn.addEventListener("click", () => {
        let currentMonth = parseInt(monthSelect.value);
        let currentSeason = parseInt(seasonSelect.value);
        let currentYear = parseInt(yearSelect.value);

        currentMonth--; 

        if (currentMonth < 0) {
          currentMonth = 4;    
          currentSeason--;     

          if (currentSeason < 0) {
            currentSeason = 3;     
            currentYear--;         

            if (currentYear < 0) {
              currentYear = 0; 
              currentSeason = 0;
              currentMonth = 0;
              return; 
            }
          }
        }

        yearSelect.value = currentYear;
        seasonSelect.value = currentSeason;
        monthSelect.value = currentMonth;
        createCalendar();
      });
  }
  
  function getAllCalendarData() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('sidereal-calendar-')) {
              data[key] = localStorage.getItem(key);
          }
      }
      return data;
  }

  function exportData() {
      const data = getAllCalendarData();
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sidereal-calendar-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Calendar data exported successfully!');
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('No file selected.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            let changesMade = false;

            for (const key in importedData) {
                if (key.startsWith('sidereal-calendar-')) {
                    const importedMonthData = JSON.parse(importedData[key]);
                    const existingMonthDataString = localStorage.getItem(key);

                    if (existingMonthDataString) {
                        const existingMonthData = JSON.parse(existingMonthDataString);
                        Object.assign(existingMonthData.wholeDay, importedMonthData.wholeDay);

                        for (const day in importedMonthData.nares) {
                            if (!existingMonthData.nares[day]) {
                                existingMonthData.nares[day] = {};
                            }
                            Object.assign(existingMonthData.nares[day], importedMonthData.nares[day]);
                        }

                        localStorage.setItem(key, JSON.stringify(existingMonthData));
                        changesMade = true;
                    } else {
                        localStorage.setItem(key, importedData[key]);
                        changesMade = true;
                    }
                }
            }

            if (changesMade) {
                alert('Calendar data merged successfully!');
                loadData(); 
            } else {
                alert('No new calendar data was found to merge.');
            }
        } catch (error) {
            alert('Error importing file. Please ensure it is a valid JSON file.');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
}

  exportBtn.addEventListener('click', exportData);
  importBtn.addEventListener('click', () => fileInput.click()); 
  fileInput.addEventListener('change', importData);

  // Initialize UI Coordinates & Populate Controls
  updateLocationUI();
  populateSelects();
  createCalendar();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
      console.log('Service Worker Registered for Calendar');
    }).catch(error => {
      console.error('Service Worker Registration Failed:', error);
    });
  }
});
