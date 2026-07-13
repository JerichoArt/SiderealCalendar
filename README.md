# **Sidereal Decimal Calendar PWA**

This project is a Progressive Web Application (PWA) that presents a unique calendar system based on a sidereal year, divided into custom decimal time units. It offers an interactive way to manage and visualize events within this alternative temporal framework.

## **Features**

* **Custom Decimal Time Units:** The calendar operates on a system where:
  * 1 Nare (Hour) = 50 Dins
  * 1 Day = 10 Nares (Hours)
  * 1 Month = 50 Days
  * 1 Season = 5 Months (Named using the Greek Alphabet: **Α (Alpha), Β (Beta), Γ (Gamma), Δ (Delta)**)
  * 1 Year = 4 Seasons
  * The smallest unit displayed in the calendar cells is an "Hour" (Nare).
* **Sidereal Year Basis:** The entire calendar system is anchored to the length of a sidereal year (approximately 365 days, 5 hours, 48 minutes, 45 seconds).
* **Interactive Calendar Grid:** Displays a grid with days and hours, allowing users to input and store text content for each "Hour" (Nare) and "Whole Day" cell.
* **Smart Arrow Pagination:** Easily cycle page-by-page through your calendar using intuitive left ($\leftarrow$) and right ($\rightarrow$) arrow buttons right next to the Month selector. The navigation automatically handles rolling multi-tier boundaries—incrementing or decrementing seasons and years gracefully when you pass the first or last month.
* **Dynamic Astronomical Overlays:** Integrates `SunCalc` API logic using geolocation to calculate and project real-time sunrise and sunset positions directly into your schedule as custom SVG Sun and Moon icons, alongside automatic highlighting for localized working hours (09:00 to 17:00 Gregorian).
* **Gregorian to Sidereal Conversion:** Input any Gregorian date and time (DD/MM/YYYY HH:MM) to instantly jump to its corresponding Sidereal date, with the display output cleanly rendering your custom Greek seasons (e.g., *Season Γ (Gamma)*).
* **Real-time Sidereal Display:** Hover over or click on any "Hour" cell to see its corresponding real-world Gregorian date and time window displayed instantly in the control box.
* **Data Persistence:** All entered calendar data is automatically saved in your browser's local storage, ensuring your entries are retained between sessions.
* **Import/Export Data:**
  * **Export:** Download your calendar data as a JSON file for backup or sharing.
  * **Import:** Load calendar data from a JSON file, featuring smart-merge functionality to combine existing entries with imported data.
* **Merge/Unmerge Cells:** Select multiple consecutive "Hour" cells to merge them horizontally into an extended duration block for events, with full single-cell unmerge capabilities.
* **Print Functionality:** Features an optimized print layout stylesheet that hides control menus and cleans cell styling to deliver a perfect, high-contrast paper copy of your calendar month.
* **"Today" Button:** Instantly snap the calendar matrix to your current real-world date, complete with distinct highlighting on the exact active day and hour.
* **PWA Capabilities:** Fully installable on desktop and mobile devices via `manifest.json` and a background `service-worker.js` for an app-like feel, fast loading times, and offline access.
* **Responsive Design:** Re-architected with independent internal viewport scrolling to prevent table cell clipping while wrapping action buttons gracefully on tight portrait mobile viewports.

---

## **How to Use**

1. **Open the Calendar:** Simply open the `index.html` file in a web browser, or launch it from your pinned taskbar application shortcut.
2. **Navigate:** Click the $\leftarrow$ and $\rightarrow$ buttons flanking the Month dropdown to page fluidly through months, seasons, and years, or use the dropdowns to jump directly to a target block.
3. **Enter Data:** Click on any "Hour" cell or "Whole Day" cell to type notes. Your changes save instantly behind the scenes.
4. **Go to Date:** Enter a target into the "Go to:" field using the `DD/MM/YYYY HH:MM` format and click "Go" to scroll the calendar automatically to that calculated sidereal coordinates window.
5. **Merge/Unmerge:** Click/drag across cells (or hold `Ctrl`/`Cmd` while clicking) to highlight multiple hour blocks on a single day, then click **Merge**. To reset, click the merged block once and click **Unmerge**.
6. **Import/Export:** Use **Export Data** at the bottom of the page to securely back up your calendar logs, or use **Import Data** to merge a previously saved configuration file.

---

## **Project Structure**

* `index.html`: The core standalone HTML file housing the structural layout interface, CSS layout parameters, and mathematical calculation engines.
* `manifest.json`: Configuration manifest mapping out PWA assets, coloring profiles, and device launch specifications.
* `service-worker.js`: Script facilitating localized resource management, performance buffering, and custom offline data delivery.

---

## **Technical Details**

* **HTML5 & Vanilla JavaScript:** Drives core application frameworks and structural algorithms entirely client-side.
* **Tailwind CSS:** Manages sleek interface styling and flexible layout configurations.
* **SunCalc API:** Leverages deep astronomical computation rules to align Gregorian solar positions into the internal Sidereal decimal matrix.
* **Local Storage:** Manages direct, secure client-side browser file persistence (no server required).
