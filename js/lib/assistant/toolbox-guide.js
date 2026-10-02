/* ============================================================
   TOOLBOX — How to use Toolbox (the Assistant's guide)

   The Assistant is the help for Toolbox: there is no separate help
   button. When someone asks how to do something in Toolbox itself
   (where a setting lives, what a shortcut does, how Files or the
   Assistant work), the model calls toolbox_help and answers from these
   sections. Kept as a tool rather than in every prompt, so ordinary
   requests pay nothing for it.

   Keep this in step with the product: it is what the Assistant believes.
   ============================================================ */

export const GUIDE = [
  {
    id: 'overview',
    title: 'What Toolbox is',
    keys: 'toolbox what is overview about start begin privacy offline browser free',
    text: `Toolbox is a collection of 170+ tools that run in the browser: images and files, PDFs, video and audio, text, developer tools, numbers and calculators, business and finance, law, science, design, security, networking, 3D models, reference, music and everyday tools. Most tools work offline and never upload anything; tools that need the internet are marked "Online". The main areas are Home, Tools, Files, About, and the Assistant. Signing in adds online Files, Assistant chats that sync, Messages, Spaces and Mail.`,
  },
  {
    id: 'home',
    title: 'Home and the search',
    keys: 'home landing search find suggestions web bubbles shortcuts start page',
    text: `Home has one search in the middle. Type a job ("compress a photo", "merge PDFs", "format JSON") and on a computer the best matches grow out of the search as bubbles: the closest bubble is the best match; hover one (or use the arrow keys) to see what it does. Enter asks the Assistant (or opens a matched device or comparison); after arrowing to a suggestion, Enter opens it; Ctrl/Cmd+Enter opens the first tool; Escape folds the suggestions away. On phones the matches are listed under the search. Under the search are your shortcuts and a card for the Assistant. Shortcuts are chosen in Settings → General → Home shortcuts (up to 8, in your order; or automatic, which shows what you use most).`,
  },
  {
    id: 'spotlight',
    title: 'Spotlight and the corner search',
    keys: 'spotlight ctrl k cmd k slash shortcut corner header search jump anywhere palette',
    text: `Press / or Ctrl+K (Cmd+K on a Mac) anywhere to open Spotlight: it searches tools, saved work and places in Toolbox (on Home, these keys go to the Home search instead). Pasting a token, JSON, a certificate or similar data anywhere outside a tool opens Spotlight with the tools that can read it. On desktop the "Search tools" box in the top corner (shown on every page except Home) opens in place with a compact list of results. On phones the search icon in the header opens Spotlight.`,
  },
  {
    id: 'tools',
    title: 'The Tools page and using a tool',
    keys: 'tools page categories browse open tool card related preferences gear send to open in result chain',
    text: `The Tools page lists every tool by category; the bar of categories at the top jumps to a category and follows as you scroll. Click a card to open a tool. Inside a tool: the heading shows its category (click it to return to that category); the gear button (when shown) opens that tool's preferences in Settings → Tools; results can be saved to Files, downloaded, or handed to another tool ("Send to" / "Open in"), so jobs chain without re-uploading. Related tools are listed below some tools. Escape goes back to the Tools page. KoreLearn appears as a tool too: it opens korelearn.com for courses and study help in a new tab.`,
  },
  {
    id: 'files',
    title: 'Files',
    keys: 'files folders upload download save storage online offline drive quick look preview tags rename move delete zip export grid list view sort',
    text: `Files keeps your documents and everything tools save. It has two drives: Offline Files (in this browser only) and Online Files (synced to your account when signed in); switch between them with the switch at the top, and move an item between them with "Move to Online Files" / "Move to Offline Files" in its right-click (long-press) menu. Three views: list, grid and preview (a list beside a live preview). Upload with the Upload button or by dropping files on the window; drag items onto folders to move them. Space opens Quick Look, Enter opens the file in its best tool, F2 renames, Delete deletes (always with a confirmation). The right-click menu also has Open in another tool, Get info, tags (coloured dots; filter by tag above the list), Download (folders as ZIP), Copy/Cut/Paste and Delete. Sort from the toolbar. Offline files are lost if the browser's site data is cleared, so download or move to Online Files anything important.`,
  },
  {
    id: 'assistant',
    title: 'The Assistant',
    keys: 'assistant ai chat ask modes auto fast deep thinking attach files pop up chats history sync limits quota usage messages small talk',
    text: `The Assistant (sign in required) chats and does real work with Toolbox's tools: maths, documents, PDFs, images, research on the web, code in the Code Playground, calendar, notes, files and more. Open it from the Assistant card on Home, from Spotlight, or "Ask Assistant" in menus; it opens as a pop-up over the page or as the full Assistant page (choose in Settings → Assistant). Modes: Auto (default), Fast, and Deep thinking for harder problems. Attach files with the + button or by dropping them. Chats are kept in the sidebar (search, pin, rename, duplicate, download as Markdown, delete) and sync across devices. Usage limits per account (resetting at midnight UTC): 40 messages a day and 150 model steps a day; quick small talk like "hello" or "thanks" does not use your messages (it has its own allowance of 120). Usage is shown in Settings → Assistant.`,
  },
  {
    id: 'selection',
    title: 'Selecting text',
    keys: 'select selection highlight copy text menu bar define rewrite writing style long press',
    text: `Select text anywhere and a small bar appears with actions such as Copy, Ask Assistant, Define (for a single word), rewriting and "Use as writing style"; in editable text there are Cut and replace actions too. Right-clicking selected text shows the same bar. On phones, press and hold on text to select a word, drag to extend it, then lift to get the bar; the browser's own selection bubble and long-press menus are turned off outside text fields.`,
  },
  {
    id: 'menus',
    title: 'Right-click and long-press menus',
    keys: 'right click context menu long press menu actions options',
    text: `Right-click (or long-press on a phone) on a tool card, a file, a chat or a page to see its menu: open, open in a new tab, add to Home shortcuts via Settings, copy links, file actions and so on. Menus show only what applies where you are.`,
  },
  {
    id: 'settings',
    title: 'Settings',
    keys: 'settings preferences profile avatar name username appearance theme dark light units metric imperial editor font haptics notifications backup export import tools mail support',
    text: `Open Settings from the account button in the header. Pages: Profile (name, @username, avatar from the gallery), Appearance (light, dark or match the device), General (units, editing and code font, haptics, Home shortcuts, and Backup to export or import your settings), Notifications (alerts, sounds, badges), Tools (per-tool preferences), Assistant (personality, pop-up, what it opens to, usage and sync, what it remembers), Mail (connected Gmail and Microsoft accounts) and Support Toolbox. Settings has a search box that finds any individual setting. Changes save immediately.`,
  },
  {
    id: 'account',
    title: 'Account and sign-in',
    keys: 'account sign in sign up login password reset passkey biometric email confirm google github test account sign out',
    text: `Sign in with email and password (confirm your email after signing up), or with Google or GitHub. You can add a passkey on a device from the account panel (the account button → Account and storage) to unlock your account there with biometrics. Forgot your password: use "Reset password" on the sign-in screen. Test, placeholder and throwaway email addresses are not allowed. Signing out keeps Offline Files in this browser; Online Files and synced chats stay in your account.`,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    keys: 'notifications bell alerts reminders badge center messages',
    text: `The bell in the header opens the notification center: reminders, messages and activity, newest first, with read and clear actions and a link to notification preferences. Short notices (like "Saved to Files") appear at the top of the screen on computers and at the bottom on phones.`,
  },
  {
    id: 'apps',
    title: 'Notes, Calendar, Mind, Mail, Messages and Spaces',
    keys: 'notes calendar mind map graph mail email messages messaging chat spaces collaborate share automations reminders code playground',
    text: `Notes holds notes with folders, tags and checklists. Calendar schedules events and reminders. Mind is a map of what you know: people, places, projects and how they connect; the Assistant can use it as context. Mail connects Gmail or Microsoft accounts to read and send email. Messages is direct messaging between Toolbox accounts; Spaces are shared rooms for working together live. Automations run Toolbox jobs on a schedule. The Code Playground is a full in-browser editor where you (or the Assistant) can build and preview small apps. All of them are opened like any tool, from Home, the Tools page or search.`,
  },
  {
    id: 'mobile',
    title: 'Toolbox on a phone',
    keys: 'mobile phone tablet touch bottom navigation install app home screen',
    text: `On phones the tab bar at the bottom switches between Home, Tools and Files; the header has search, theme, notifications and your account. Long-press opens menus; press and hold on text selects it. Toolbox can be added to the home screen from the browser's share or menu ("Add to Home Screen") and then opens like an app.`,
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    keys: 'keyboard shortcuts keys hotkeys',
    text: `/ or Ctrl/Cmd+K: search (Spotlight, or the Home search on Home). Escape: close menus and search, or leave a tool for the Tools page. In Files: Space Quick Look, Enter open, F2 rename, Delete delete, Ctrl/Cmd+A select all, Ctrl/Cmd+C / X / V copy, cut and paste, arrow keys move. In the Home search: arrow keys choose a suggestion, Enter opens it or asks the Assistant, Ctrl/Cmd+Enter opens the first tool.`,
  },
  {
    id: 'support',
    title: 'Support, bugs and KoreLearn',
    keys: 'support help bug report complain contact feedback request tool supporter donate contribute korelearn learn study',
    text: `Found a bug or want a tool built: open About → Support (or ask the Assistant to help you describe it). You can support Toolbox's development in Settings → Support Toolbox. KoreLearn, Toolbox's learning partner, has courses, practice questions and study plans: open it from its tool card or from the banner the Assistant shows for study requests.`,
  },
];

const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9+/]+/g) || [];

/** The guide sections that best answer a question (up to three), or the list of topics. */
export function toolboxHelp(topic = '') {
  const q = words(topic);
  if (!q.length) return { status: 'success', topics: GUIDE.map(g => g.title), message: 'Ask about any of these topics.' };
  const scored = GUIDE.map(g => {
    const hay = new Set(words(`${g.title} ${g.keys}`));
    const body = words(g.text);
    let score = 0;
    for (const w of q) { if (hay.has(w)) score += 3; else if (body.includes(w)) score += 1; }
    return { g, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const pick = scored.length ? scored.map(x => x.g) : [GUIDE[0]];
  return {
    status: 'success',
    silent: true,
    sections: pick.map(g => ({ title: g.title, text: g.text })),
    message: 'Answer from these sections of the Toolbox guide. Give the steps plainly; do not mention that you looked them up.',
  };
}

export const TOOLBOX_HELP_DECLARATION = {
  name: 'toolbox_help',
  description: 'How to use Toolbox itself: where things are, how Home search, Spotlight, Files, the Assistant, Settings, menus, text selection, notifications, account and shortcuts work. Call this before answering any question about using Toolbox, and answer from what it returns.',
  parameters: {
    type: 'object',
    properties: { topic: { type: 'string', description: 'The question or topic in a few words, e.g. "move file to online files", "change theme".' } },
    required: ['topic'],
  },
};
