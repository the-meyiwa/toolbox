# Automations and notifications

## Notifications

`js/lib/notifications.js` keeps each account's notifications (the bell) and delivers each new one:

| Where the person is | What they get |
|---|---|
| Looking at Toolbox | A toast, plus the chime if sounds are on |
| Toolbox in the background, or another app in front | A system notification, if **System alerts** is on and the browser allows it |

- System notifications are shown through the service worker (`registration.showNotification`). Chrome on Android and most mobile browsers refuse `new Notification()` outright, so this is what makes them appear on phones. Desktop browsers without a service worker fall back to `new Notification()`.
- `public/pg-sw.js` is the one service worker on the origin (it also serves the Code Playground's input bridge). Its `notificationclick` handler focuses an open Toolbox tab and opens the notification's link there, or opens a new tab.
- The chime is unlocked on the first tap or key press, since browsers only allow sound after a gesture.
- The unread count is shown on the installed app's icon where the browser supports `setAppBadge`.
- Settings → Notifications has a **Send test** button.

Sources: new messages, reminders, Spaces, automations, and the Assistant (when a reply that took more than a few seconds finishes while the person is elsewhere).

Everything runs in the browser, so alerts come while Toolbox is open in a tab (it can be in the background). Delivering with the browser fully closed would need Web Push from a server.

## Automations

An automation is a trigger and a list of steps (`js/lib/automations.js`):

- **Triggers:** a schedule (a five-field cron line, local time; the editor builds it from "every day / weekday / week / month / hour / N minutes at …"), once at a date and time, or whenever Toolbox opens.
- **Steps**, run in order. Each can use the previous step's output as `{{previous}}`:
  - `notify` — the bell, a toast or a system alert;
  - `assistant` — asks the Assistant (fast mode, at most 4 tool steps); its answer is the output;
  - `tool` — runs any Toolbox tool through the Assistant bridge;
  - `note` — saves a note;
  - `open` — a notification that opens a tool when tapped.

Rules:

- Schedules run at most every 5 minutes; automations with an `assistant` step at most hourly (they use the model quota).
- Each scheduled time runs once, even with several tabs open.
- A run missed while Toolbox was closed runs once when it next opens, if it was due in the last 24 hours. Older missed runs are skipped rather than piled up.
- `once` automations switch themselves off after running. A failed step stops the run, is logged, and sends a notification.

People manage automations in the **Automations** tool (`#automations`) or by asking the Assistant ("every weekday at 8, send me a briefing"), which uses `create_automation`, `list_automations`, `update_automation`, `delete_automation` and `run_automation` (`js/lib/assistant/automation-tools.js`).
