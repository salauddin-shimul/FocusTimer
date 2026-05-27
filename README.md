# Focus Timer — Chrome Extension
 
A Chrome extension that splits your browser tabs into **Work** and **Play** groups. While a work session is running, play-group tabs are blocked and replaced with a distraction page. When the timer ends, they're unlocked automatically.
 
Built with vanilla HTML, CSS, and JavaScript using the Chrome Extensions **Manifest V3** API — no frameworks, no build tools.
 
---
 
## Features
 
- **Tab grouping** — assign any open tab to either your Work group or Play group
- **Work mode** — start a countdown timer; play tabs become inaccessible while it runs
- **Play mode** — when the timer ends (or you take a break), all tabs are unlocked
- **Blocked page** — play-group tabs redirect to a friendly page instead of just erroring
- **Persistent state** — your tab groups are saved across browser restarts via `chrome.storage`
- **Notifications** — Chrome notifies you when a session ends and mode switches
---
 
## Project structure
 
```
focus-timer/
├── manifest.json        # Extension config and permissions (Manifest V3)
├── background.js        # Service worker — enforces tab blocking rules
├── popup.html           # UI shown when you click the toolbar icon
├── popup.js             # Timer logic and tab group management
├── popup.css            # Popup styles
├── blocked.html         # Page shown when a play tab is accessed during work mode
└── icons/
    └── icon128.png      # Toolbar icon
```
 
---
 
## How it works
 
```
User clicks toolbar icon
        │
        ▼
   popup.html opens
        │
   Add tabs to Work or Play group
        │
   Start work timer
        │
        ▼
background.js (service worker)
        │
   Listens for tab navigation events
        │
   If mode = "work" AND tab URL is in Play group
        │
        ▼
   Redirect tab → blocked.html
        │
   Timer reaches zero → switch to Play mode → unblock tabs
```
 
The service worker (`background.js`) runs silently even when the popup is closed, which is what allows tab blocking to persist throughout your session.
 
---
 
## Installation (development)
 
1. Clone this repository:
   ```bash
   git clone https://github.com/salauddin-shimul/FocusTimer.git
   ```
 
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** using the toggle in the top-right corner
4. Click **Load unpacked** and select the `FocusTimer` folder
5. The extension will appear in your toolbar — click the puzzle-piece icon and pin it
---
 
## Permissions used
 
| Permission | Why it's needed |
|---|---|
| `tabs` | Read and update tab URLs to enforce group rules |
| `storage` | Persist work/play tab lists and timer state across sessions |
| `webNavigation` | Detect when a user navigates to a play-group tab |
| `notifications` | Alert the user when a session ends and mode switches |
 
---
 
## Development roadmap
 
- [x] Phase 1 — Project scaffold, manifest, and folder structure
- [ ] Phase 2 — Popup UI (timer display, work/play toggle, tab group lists)
- [ ] Phase 3 — Background service worker, `chrome.storage` integration, tab event listeners
- [ ] Phase 4 — Tab blocking logic, `blocked.html` redirect page, countdown timer
- [ ] Phase 5 — Chrome notifications, icon design, Chrome Web Store packaging
---
 
## Tech stack
 
- **Vanilla JavaScript** — no frameworks or bundlers
- **Chrome Extensions API** — Manifest V3
- **`chrome.storage.local`** — for persisting state
- **`chrome.webNavigation`** — for intercepting tab loads
- **`chrome.notifications`** — for session-end alerts
---
 
## Learning notes
 
This project is being built as a learning exercise, working through the Chrome Extensions API from scratch. Each phase introduces a new concept:
 
- **Phase 1** — what `manifest.json` is and how Chrome loads an extension
- **Phase 2** — building a popup UI with HTML/CSS, Chrome popup constraints
- **Phase 3** — service workers, async JavaScript, `chrome.storage`
- **Phase 4** — event-driven programming, URL interception, `setInterval` timers
- **Phase 5** — packaging, icons, and publishing
---

AI was used to help with this project.

## License
 
MIT
