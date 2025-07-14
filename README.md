Sidereal Decimal Calendar PWA
This project is a Progressive Web Application (PWA) that presents a unique calendar system based on a sidereal year, divided into custom decimal time units. It offers an interactive way to manage and visualize events within this alternative temporal framework.

Features
Custom Decimal Time Units: The calendar operates on a system where:

1 Day = 10 Hours (Nares)

1 Month = 50 Days

1 Season = 5 Months

1 Year = 4 Seasons

The smallest unit displayed in the calendar cells is an "Hour" (Nare).

Sidereal Year Basis: The entire calendar system is anchored to the length of a sidereal year (approximately 365 days, 5 hours, 48 minutes, 45 seconds).

Interactive Calendar Grid: Displays a grid with days and hours, allowing users to input and store text content for each "Hour" (Nare) and "Whole Day" cell.

Navigation: Easily navigate through Years, Seasons, and Months using dropdown selectors.

Gregorian to Sidereal Conversion: Input a Gregorian date and time (DD/MM/YYYY HH:MM) to instantly jump to the corresponding Sidereal date and highlight the relevant "Hour" cell.

Real-time Sidereal Display: Click on any "Hour" cell to see its corresponding Gregorian date and time displayed in the control box.

Data Persistence: All entered calendar data is automatically saved in your browser's local storage, ensuring your entries are retained between sessions.

Import/Export Data:

Export: Download your calendar data as a JSON file for backup or sharing.

Import: Load calendar data from a JSON file, with a merge functionality to combine existing data with imported data.

Merge/Unmerge Cells: Allows for combining or separating "Hour" cells to create larger blocks for events.

Print Functionality: Optimized printing layout to get a clean paper copy of your calendar.

"Today" Button: Quickly navigate to the current sidereal day based on the real-world date.

PWA Capabilities: Can be installed on your device for an app-like experience, offering offline access and faster loading times (requires manifest.json and service-worker.js to be present).

Responsive Design: Optimized for viewing on various screen sizes, from mobile to desktop.

Modern Styling: Utilizes Tailwind CSS for a clean and modern user interface.

How to Use
Open the Calendar: Simply open the index.html file in a web browser.

Navigate: Use the "Year," "Season," and "Month" dropdowns to browse the calendar.

Enter Data: Click on any "Hour" cell or "Whole Day" cell to type in your notes or events. Your changes are saved automatically.

Go to Date: Use the "Go to:" input field (format: DD/MM/YYYY HH:MM) and click "Go" to jump to a specific Gregorian date's equivalent in the sidereal calendar.

View Gregorian Time: Click on any "Hour" cell in the calendar to see its corresponding Gregorian date and time displayed above the calendar.

Merge/Unmerge: Select multiple "Hour" cells by clicking and dragging (or Ctrl/Cmd+clicking) and use the "Merge" button to combine them. Use "Unmerge" to separate them.

Print: Click the "Print" button to generate a printable version of the current calendar view.

Import/Export: Use the "Export Data" button to save your data, and "Import Data" to load a JSON file.

Project Structure
index.html: The main HTML file containing the calendar interface, logic, and styling.

manifest.json: (Assumed) The web app manifest file, enabling PWA features.

service-worker.js: (Assumed) The service worker script for offline capabilities and caching.

Technical Details
HTML5: Provides the structure of the web page.

CSS3 (Tailwind CSS): Used for styling and responsive design.

JavaScript: Powers the calendar's logic, date conversions, data persistence, and interactive features.

PWA: Utilizes manifest.json and service-worker.js for installability and offline support.

Local Storage: Used for client-side data persistence.

Customization
The core time unit definitions and other calendar constants can be modified within the JavaScript section of index.html to experiment with different temporal systems or adjust the calendar's behaviour.
