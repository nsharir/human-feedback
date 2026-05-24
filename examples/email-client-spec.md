# Email Client — Functional Specification (v0.1 draft)

> Generated from the requirements questionnaire on 2026-05-24. This is a **draft** — every section is open to inline feedback. Highlight any sentence, paragraph, or heading to leave a comment.

## 1. Overview

We are building **Mailbox** (working title), a cross-platform email client targeting individual power users who manage multiple accounts and want a fast, keyboard-first experience with optional AI assistance. The product positions itself between Apple Mail (simple, native) and Superhuman (opinionated, AI-heavy).

**Out of scope for v1:** shared team inboxes, public API, mobile (iOS/Android), and PGP/S/MIME. These are explicit non-goals to keep the v1 surface area manageable.

## 2. Target user

A "power user" is defined as someone who:

- Manages **2–5 email accounts** simultaneously (work + personal).
- Processes **100+ emails per day**.
- Uses keyboard shortcuts heavily and resents reaching for the mouse.
- Cares about latency more than features — every interaction should feel instant.

We are NOT targeting: enterprise IT buyers, casual users, or developers looking for a CLI tool.

## 3. Supported platforms (v1)

| Platform | Status |
|---|---|
| Web app (PWA) | ✅ Primary |
| macOS desktop (Electron) | ✅ Primary |
| Windows desktop | 🟡 Stretch |
| Linux desktop | 🟡 Stretch |
| iOS / Android | ❌ v2+ |

## 4. Supported providers (v1)

1. **Gmail / Google Workspace** — OAuth, Gmail API for native labels & threading.
2. **Outlook / Microsoft 365** — OAuth, Microsoft Graph API.
3. **Generic IMAP/SMTP** — fallback for everything else (Fastmail, iCloud, custom domains).

ProtonMail (requires the Bridge), Exchange on-prem, and JMAP are deferred.

## 5. Core features

### 5.1 Unified inbox

A single virtual inbox view aggregating messages from all connected accounts. Each row shows the account color/icon. Search and filters operate across accounts by default; users can scope to one account with `a <account-letter>`.

### 5.2 Threaded conversation view

Gmail-style threading. Quoted replies are collapsed by default. Inline images render eagerly; remote tracking pixels are blocked unless the sender is in the user's address book.

### 5.3 Full-text search (offline)

A local SQLite FTS5 index over all synced message bodies, indexed on receive. Search must return results in <100ms for a 100k-message archive. Search syntax supports `from:`, `to:`, `subject:`, `has:attachment`, and date ranges.

### 5.4 Snooze & send later

- **Snooze**: removes a thread from the inbox and re-surfaces it at a chosen time. Stored as a per-message label, synced via the provider's native label system where possible (Gmail), otherwise via a local-only flag.
- **Send later**: drafts queued locally; sent by a background process when the scheduled time arrives. If the app is closed, sends happen on next launch.

### 5.5 Keyboard navigation

A Vim-inspired scheme with single-key shortcuts: `j/k` move between messages, `r` reply, `a` reply all, `f` forward, `e` archive, `#` delete, `/` search, `gi` go to inbox. Full cheatsheet via `?`.

### 5.6 AI assistance (optional)

User opts in per-account. Features:

- **Inbox triage**: highlight messages requiring a response within 24h.
- **Draft suggestions**: when composing a reply, the AI offers a 1-paragraph draft from thread context.
- **Summarize thread**: condense long threads into a 3-bullet summary.

AI calls are routed through the user's own API key (BYO) for v1. No data is sent to our servers.

## 6. Privacy posture

Message bodies live on the user's device. Our cloud (if any) only stores:

- Account connection metadata (email address, OAuth refresh tokens encrypted at rest).
- Per-device sync state (last-seen UIDs, label cache).

Bodies are NEVER uploaded to our infrastructure. AI features go directly from the user's device to their chosen LLM provider.

## 7. Offline support

The app must be **fully functional offline**:

- Reading any synced message.
- Composing new messages and replies (queued for send on reconnect).
- Searching the local index.
- Applying labels, snoozing, archiving (queued mutations replayed on reconnect).

Sync is opportunistic and resumable. A clear indicator shows online/offline state.

## 8. Non-goals (explicit)

- Shared team inboxes / multi-user accounts.
- Email marketing or bulk send features.
- A public API or webhooks.
- Custom email servers — we are a client, not a host.
- PGP/S/MIME — deferred to v2 pending demand.

## 9. Success metrics

| Metric | Target at 6 months |
|---|---|
| Daily active users | 1,000 |
| Inbox-to-zero rate (% of users) | 30% |
| Median time-to-first-archive (new user) | <30s |
| Crash-free sessions | 99.5% |

## 10. Open questions

1. Do we ship a **paid tier** at launch, or stay free during beta?
2. Should the AI features be **opt-in per feature** or **opt-in once per account**?
3. How do we handle **Gmail's API quota** (1B units/day default) at scale?
4. Are **stretch platforms** (Windows, Linux) acceptable as "community-supported, not officially tested"?

---

*Next step: once this spec is approved, the agent will produce a clickable HTML mockup of the main inbox view for visual feedback.*
