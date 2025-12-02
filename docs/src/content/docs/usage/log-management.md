---
title: Log Management
description: Working with logs in DevProc
---

DevProc provides powerful log management capabilities including streaming, searching, filtering, and exporting.

## Log View

The right panel of the TUI displays logs. Each log line shows:

```
[12:34:56] service-name | Log message content
```

- **Timestamp** - When the log was received
- **Service name** - Which service produced the log (in "all" view mode)
- **Content** - The actual log message

### Stderr Output

Lines from stderr are displayed in red to distinguish errors from normal output.

## View Modes

### Single Service View (Default)

Shows logs only from the currently selected service.

- Select a service with `↑/↓` or `j/k`
- Only that service's logs are displayed
- Header shows: `Logs (api)`

### All Services View

Shows interleaved logs from all services, sorted by timestamp.

- Press `Tab` to switch to this view
- Service name is shown for each line
- Header shows: `Logs (all)`

Useful for seeing how services interact chronologically.

## Following Logs

### Auto-Follow (Default)

New logs automatically scroll into view. The indicator shows `[follow]` in green.

### Manual Scrolling

When you scroll manually:

- Follow mode is temporarily disabled
- Indicator changes to `[scroll]` in gray
- New logs still arrive but don't auto-scroll

### Re-enabling Follow

- Press `f` to toggle follow mode
- Press `G` to scroll to bottom and enable follow
- New logs will start auto-scrolling again

## Scrolling

| Key      | Action           |
| -------- | ---------------- |
| `g`      | Scroll to top    |
| `G`      | Scroll to bottom |
| `PgUp`   | Page up          |
| `PgDn`   | Page down        |
| `Ctrl+u` | Half page up     |
| `Ctrl+d` | Half page down   |

The scroll position indicator shows `123/456` (current line / total lines).

## Searching Logs

### Start a Search

1. Press `/` to open the search prompt
2. Type your search query
3. Press `Enter` to search

### Navigate Matches

- `n` - Jump to next match
- `N` - Jump to previous match
- `Esc` - Clear search

### Search Status

The header shows search status: `/error [3/15]`

- `/error` - Current search query
- `[3/15]` - Viewing match 3 of 15 total

### Regular Expressions

Search supports full regex syntax:

```
/error                 # Simple text search
/ERROR|WARN            # Multiple patterns
/status:\s*\d{3}       # Status codes
/\[api\].*timeout      # Service-specific errors
/(?i)exception         # Case-insensitive
```

### Highlighting

- All matches are highlighted with a yellow background
- The current match has a brighter highlight
- Navigate between matches to see each in context

## Clearing Logs

Press `c` to clear logs for the selected service.

- Only affects the display buffer
- Doesn't affect the actual service
- New logs continue to appear

Useful for:

- Starting fresh after fixing an error
- Reducing noise during debugging

## Exporting Logs

### Export Single Service

Press `e` to export logs from the currently selected service.

Creates: `devproc-api-1699876543210.log`

### Export All Logs

Press `E` (Shift+e) to export logs from all services.

Creates: `devproc-all-1699876543210.log`

### Export Format

Plain text with timestamps:

```
[12:34:56] api | Server starting...
[12:34:57] api | Listening on port 3000
[12:35:01] api | GET /health 200 2ms
```

## Clipboard

### Copy Last Line

Press `y` to copy the most recent log line to clipboard.

Useful for quickly sharing an error message.

### Copy All Visible

Press `Y` (Shift+y) to copy all visible logs to clipboard.

Useful for sharing a sequence of events.

### Platform Support

- **macOS**: Uses `pbcopy`
- **Linux**: Uses `xclip` or `xsel`
- **WSL**: Uses `clip.exe`

Status message confirms: `Copied to clipboard` or `Copied 123 lines`

## Log Buffer

### Buffer Size

Each service maintains a circular buffer of the most recent 1000 log lines.

When the buffer is full:

- Oldest lines are discarded
- Newest lines are kept
- This prevents memory issues during long sessions

### Memory Usage

With default settings:

- ~1000 lines per service
- Approximately 1-5MB per service depending on log verbosity

## Best Practices

### Use Service-Specific Logging

Configure your services to include context:

```javascript
// Good
console.log("[api] User created:", userId)

// Less helpful
console.log("User created")
```

### Use Structured Logging

JSON logs can still be searched:

```bash
/level.*error     # Find error level logs
/duration.*[5-9]\d{2}  # Find slow requests (500ms+)
```

### Export Before Clearing

If you might need logs later, export before clearing:

1. Press `e` to export
2. Press `c` to clear

### Use Regex for Complex Searches

```bash
# Find errors from multiple services
/\[(api|worker)\].*error

# Find HTTP errors
/\b[45]\d{2}\b

# Find slow operations
/took\s+\d{4,}ms
```
