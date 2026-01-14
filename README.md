# Slack Status Automator

Automatically manage your Slack status based on your work schedule, holidays, and custom overrides using Google Apps Script.

## Features

- **Automatic Status Updates**: Sets your Slack status based on time of day (work hours, lunch, breaks)
- **Holiday Detection**: Automatically detects US federal holidays and sets "Out of Office" status
- **Weekend Detection**: Recognizes weekends and adjusts presence accordingly
- **Custom Vacation Periods**: Pre-configured vacation periods with custom emojis
- **Manual Overrides**: Set custom statuses that override the automatic schedule for any duration
- **Random Emoji Selection**: Daily rotation of emojis for lunch, breaks, and holidays
- **Timezone Support**: Configured for US Central time (customizable)

## Setup

### 1. Create Slack App & Get Token

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name it (e.g., "Status Automator") and select your workspace
4. Navigate to "OAuth & Permissions"
5. Add these **User Token Scopes**:
   - `users.profile:write`
   - `users:write`
6. Click "Install to Workspace" and authorize
7. Copy the **User OAuth Token** (starts with `xoxp-`)

### 2. Set Up Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Copy the contents of `Code.gs` into the script editor
4. Go to **Project Settings** (gear icon)
5. Under **Script Properties**, add:
   - Key: `USER_TOKEN`
   - Value: Your Slack User OAuth Token

### 3. Enable Google Calendar API

1. In your Apps Script project, click **Services** (+ icon)
2. Find and add **Google Calendar API**

### 4. Set Up Triggers

1. Click the **Triggers** icon (clock) in the left sidebar
2. Click **+ Add Trigger**
3. Configure:
   - Function: `updateUserStatus`
   - Event source: **Time-driven**
   - Type: **Minutes timer**
   - Interval: **Every 15 minutes** (or your preference)

## Configuration

### Work Hours

Edit the `WORK_HOURS` section in `CONSTANTS`:

```javascript
WORK_HOURS: {
  START: 9,           // 9 AM
  END: 17,            // 5 PM
  LUNCH_START: 13,    // 1 PM
  LUNCH_END: 14,      // 2 PM
  BREAK_START: 15,    // 3 PM
  BREAK_END: 15.25,   // 3:15 PM
}
```

### Vacation Periods

Add custom vacation periods in `VACATION_PERIODS`:

```javascript
SUMMER_VACATION: { 
  start: '08-01', 
  end: '08-15', 
  name: 'Summer Vacation', 
  emoji: '🏖️' 
}
```

### Timezone

Change the timezone in `CONSTANTS`:

```javascript
TZ: 'US/Eastern',  // or 'US/Pacific', 'UTC', etc.
```

### Custom Emojis

Modify the emoji pools in `CONSTANTS.EMOJIS`:

```javascript
EMOJIS: {
  HOLIDAY: ['🌴', '🏔️', '🏖️', '📖', '🎮'],
  LUNCH:   ['🍱', '🍛', '🍜', '🍝', '🍣'],
  BREAK:   ['☕', '🍵', '🥤', '🍡', '🍩'],
}
```

## Usage

### Manual Overrides

Set temporary custom statuses that override the automatic schedule:

```javascript
// 3-hour "Do Not Disturb" with away presence
setStatusOverride(3, 'In a Meeting', '📞', 'away');

// 1-week vacation with away presence
setStatusOverride(168, 'On Vacation', '🏖️', 'away');

// Custom status without changing presence
setStatusOverride(2, 'Heads Down Work', '🎧', null);

// Clear any active override
clearStatusOverride();
```

Run these functions from the Apps Script editor, or create custom menu items.

### Testing

Run `testSlackStatus()` to verify your Slack token is working:

```javascript
function testSlackStatus() {
  const token = PropertiesService.getScriptProperties().getProperty('USER_TOKEN');
  updateSlackStatus(token, {
    text: 'Testing from Apps Script',
    emoji: ':robot_face:',
    presence: 'auto',
    expirationTs: 0,
  });
}
```

## Status Logic

The script follows this priority order:

1. **Manual Override** (if active) → Overrides everything
2. **Vacation Period** (24/7) → Takes precedence over schedule
3. **Outside Work Hours / Weekend** → Sets away status
4. **US Federal Holiday** (during work hours) → "Out of Office"
5. **Work Schedule** (weekday during work hours):
   - Lunch time → "Lunch Break"
   - Break time → "Short Break"
   - Otherwise → Default (active)

## Customization Examples

### Add Custom Statuses

```javascript
STATUSES: {
  COMMUTE: { presence: 'away', text: 'Commuting', emoji: '🚗' },
  FOCUS: { presence: 'auto', text: 'Deep Work', emoji: '🎯' },
}
```

### Create Menu for Quick Actions

Add this to create a custom menu in Google Sheets (if you want a UI):

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Slack Status')
    .addItem('Set Vacation (1 week)', 'setVacationStatus')
    .addItem('Clear Override', 'clearStatusOverride')
    .addToUi();
}
```

## Troubleshooting

### Status Not Updating

- Verify `USER_TOKEN` is set in Script Properties
- Check trigger is running (View → Executions)
- Review execution logs for errors

### Wrong Timezone

- Update `CONSTANTS.TZ` to your timezone
- Restart triggers after changing timezone

### Holidays Not Detected

- Verify Google Calendar API is enabled
- Check `CONSTANTS.CALENDAR_ID` is correct
- Test with `isHoliday(new Date())` in the script editor

## Security Notes

- **Never commit your Slack token to version control**
- The token is stored in Google Apps Script Properties (encrypted by Google)
- Use a User Token (not Bot Token) for personal status updates
- Limit token scope to only required permissions

## License

MIT License - Feel free to modify and use for your own purposes.

## Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Share your custom configurations

## Credits

Created for automated Slack status management with smart scheduling and override capabilities.
