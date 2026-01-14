/***********************
 * CONFIG / CONSTANTS
 ***********************/
const CONSTANTS = {
  VACATION_PERIODS: {
    NEW_YEARS:              { start: '01-01', end: '01-01', name: "New Year's Day",              emoji: '🎉' },
    MARTIN_LUTHER_KING:     { start: '01-17', end: '01-17', name: "Martin Luther King Jr. Day",  emoji: '✊🏾' },
    PRESIDENTS_DAY:         { start: '02-21', end: '02-21', name: "Presidents' Day",             emoji: '🇺🇸' },
    MEMORIAL_DAY:           { start: '05-30', end: '05-30', name: "Memorial Day",                emoji: '🎖️' },
    INDEPENDENCE_DAY:       { start: '07-04', end: '07-04', name: 'Independence Day',            emoji: '🇺🇸' },
    LABOR_DAY:              { start: '09-05', end: '09-05', name: "Labor Day",                   emoji: '👷' },
    INDIGENOUS_PEOPLES_DAY: { start: '10-10', end: '10-10', name: "Indigenous Peoples' Day",     emoji: '🦅' },
    VETERANS_DAY:           { start: '11-11', end: '11-11', name: "Veterans Day",                emoji: '🎖️' },
    THANKSGIVING:           { start: '11-24', end: '11-25', name: 'Thanksgiving',                emoji: '🦃' },
    CHRISTMAS:              { start: '12-24', end: '12-26', name: 'Christmas',                   emoji: '🎄' },
  },

  WORK_HOURS: {
    START: 9,
    END: 17,
    LUNCH_START: 13,
    LUNCH_END: 14,
    BREAK_START: 15,
    BREAK_END: 15.25, // 15 minutes
  },

  STATUSES: {
    DEFAULT:      { presence: 'auto', text: '',            emoji: '' },
    OUTSIDE_WORK: { presence: 'away', text: '',            emoji: '' },
    HOLIDAY:      { presence: 'away', text: 'Out of Office', emoji: '' },
    LUNCH:        { presence: 'away', text: 'Lunch Break', emoji: '' },
    BREAK:        { presence: 'auto', text: 'Short Break', emoji: '' },
  },

  // Use the official US Holidays calendar
  CALENDAR_ID: 'en.usa#holiday@group.v.calendar.google.com',

  EMOJIS: {
    HOLIDAY: ['🌴', '🏔️', '🏖️', '📖', '🎮'],
    LUNCH:   ['🍱', '🍛', '🍜', '🍝', '🍣', '🍙', '🍔', '🥪', '🥗', '🍕'],
    BREAK:   ['☕', '🍵', '🥤', '🍡', '🍩'],
  },

  TZ: 'US/Central',
};

// ScriptProperties keys
const PROP_USER_TOKEN = 'USER_TOKEN';
const PROP_STATUS_OVERRIDE = 'STATUS_OVERRIDE';


/***********************
 * EMOJI HELPERS
 ***********************/
function getRandomEmoji(type) {
  const emojis = CONSTANTS.EMOJIS[type];
  if (!Array.isArray(emojis) || emojis.length === 0) {
    Logger.log('getRandomEmoji: unknown or empty emoji type: ' + type);
    return '';
  }
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function getTodayEmoji(type) {
  const today = new Date().toDateString();
  const props = PropertiesService.getScriptProperties();

  const storedEmoji = props.getProperty(`TODAY_${type}_EMOJI`);
  const storedDate  = props.getProperty(`${type}_EMOJI_DATE`);

  if (storedEmoji && storedDate === today) return storedEmoji;

  const newEmoji = getRandomEmoji(type);
  props.setProperty(`TODAY_${type}_EMOJI`, newEmoji);
  props.setProperty(`${type}_EMOJI_DATE`, today);
  return newEmoji;
}


/***********************
 * OVERRIDE (CUSTOMIZABLE)
 ***********************/
/**
 * Sets an override for N hours. While active:
 * - updateUserStatus() will apply ONLY the override status
 * - schedule-based changes (lunch/break/etc.) will not run
 *
 * Uses Slack status_expiration so Slack auto-clears the status too.
 * 
 * @param {number} hours - Duration in hours
 * @param {string} text - Status text
 * @param {string} emoji - Status emoji
 * @param {string} presence - 'auto', 'away', or null to omit presence setting
 */
function setStatusOverride(hours = 3, text = 'Locked in: No Meetings', emoji = '🎧', presence = 'auto') {
  const props = PropertiesService.getScriptProperties();
  const untilMs = Date.now() + hours * 60 * 60 * 1000;
  const expirationTs = Math.floor(untilMs / 1000); // Slack wants seconds

  const override = {
    untilMs,
    status: {
      text,
      emoji,
      expirationTs,
    },
  };

  // Only include presence if explicitly provided
  if (presence) {
    override.status.presence = presence;
  }

  props.setProperty(PROP_STATUS_OVERRIDE, JSON.stringify(override));
  Logger.log(`Override set until ${new Date(untilMs).toString()}: ${text} ${emoji} (presence: ${presence || 'not set'})`);

  // Push immediately
  const token = props.getProperty(PROP_USER_TOKEN);
  if (token) {
    updateSlackStatus(token, override.status);
  } else {
    Logger.log('USER_TOKEN not set in Script Properties.');
  }
}

function clearStatusOverride() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROP_STATUS_OVERRIDE);
  Logger.log('Override cleared.');
}

function getActiveOverride() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PROP_STATUS_OVERRIDE);
  if (!raw) return null;

  let override;
  try {
    override = JSON.parse(raw);
  } catch (e) {
    props.deleteProperty(PROP_STATUS_OVERRIDE);
    return null;
  }

  if (!override.untilMs || Date.now() > Number(override.untilMs)) {
    props.deleteProperty(PROP_STATUS_OVERRIDE);
    Logger.log('Override expired and was cleared.');
    return null;
  }

  return override;
}

function debugOverride() {
  const props = PropertiesService.getScriptProperties();
  Logger.log('STATUS_OVERRIDE raw: ' + props.getProperty(PROP_STATUS_OVERRIDE));
  const ov = getActiveOverride();
  Logger.log('Active override? ' + (ov ? 'YES' : 'NO'));
}


/***********************
 * MAIN ENTRY (TRIGGER)
 ***********************/
function updateUserStatus() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(PROP_USER_TOKEN);
  if (!token) throw new Error('Missing USER_TOKEN in Script Properties.');

  // 1) Override wins
  const override = getActiveOverride();
  if (override) {
    updateSlackStatus(token, override.status);
    Logger.log(`Override active until ${new Date(override.untilMs).toString()}: ${override.status.text} ${override.status.emoji}`);
    return;
  }

  // 2) Normal schedule-based status
  const now = new Date();
  const currentStatus = determineStatus(now);

  updateSlackStatus(token, currentStatus);
  Logger.log(`Status updated to: ${currentStatus.text} ${currentStatus.emoji}`);
}


/***********************
 * STATUS LOGIC
 ***********************/
function determineStatus(date = new Date()) {
  // Explicit vacation periods win 24/7
  const vacationPeriod = checkVacationPeriod(date);
  if (vacationPeriod) {
    return { presence: 'away', text: vacationPeriod.name, emoji: vacationPeriod.emoji };
  }

  const { WORK_HOURS, STATUSES } = CONSTANTS;
  const hours = date.getHours() + date.getMinutes() / 60;

  // Outside work hours OR weekend → OUTSIDE_WORK
  if (hours < WORK_HOURS.START || hours >= WORK_HOURS.END || isWeekend(date)) {
    return STATUSES.OUTSIDE_WORK;
  }

  // Inside work hours weekday: if holiday → Out of Office + holiday emoji
  if (isHoliday(date)) {
    const { presence, text } = STATUSES.HOLIDAY;
    return { presence, text, emoji: getTodayEmoji('HOLIDAY') };
  }

  // Normal workday inside hours: lunch/break/default
  return getWorkdayStatus(date);
}

function isHoliday(date) {
  const calendar = CalendarApp.getCalendarById(CONSTANTS.CALENDAR_ID);
  const events = calendar.getEventsForDay(date);
  // Only all-day events count as holidays
  return events.some(e => e.isAllDayEvent());
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getWorkdayStatus(date) {
  const hours = date.getHours() + date.getMinutes() / 60;
  const { WORK_HOURS, STATUSES } = CONSTANTS;

  if (hours >= WORK_HOURS.LUNCH_START && hours < WORK_HOURS.LUNCH_END) {
    const { presence, text } = STATUSES.LUNCH;
    return { presence, text, emoji: getTodayEmoji('LUNCH') };
  }

  if (hours >= WORK_HOURS.BREAK_START && hours < WORK_HOURS.BREAK_END) {
    const { presence, text } = STATUSES.BREAK;
    return { presence, text, emoji: getTodayEmoji('BREAK') };
  }

  return STATUSES.DEFAULT;
}

function checkVacationPeriod(date) {
  const formatted = Utilities.formatDate(date, CONSTANTS.TZ, 'MM-dd');
  return Object.values(CONSTANTS.VACATION_PERIODS).find(period =>
    isDateInRange(formatted, period.start, period.end)
  );
}

function isDateInRange(date, start, end) {
  if (start <= end) return date >= start && date <= end;
  // spans year boundary
  return date >= start || date <= end;
}


/***********************
 * SLACK API
 ***********************/
function updateSlackStatus(token, status) {
  const presenceUrl = 'https://slack.com/api/users.setPresence';
  const statusUrl   = 'https://slack.com/api/users.profile.set';

  // Set presence if provided in status object
  if (status.presence) {
    updatePresence(presenceUrl, token, status.presence);
  }

  // Always set profile status (text/emoji + optional expiration)
  updateStatus(statusUrl, token, status.text || '', status.emoji || '', status.expirationTs || 0);
}

function updatePresence(url, token, presence) {
  const options = {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    payload: JSON.stringify({ presence }),
    timeout: 30,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error('Slack Presence API error: ' + JSON.stringify(result));
}

function updateStatus(url, token, status_text, status_emoji, status_expiration) {
  const options = {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    payload: JSON.stringify({
      profile: {
        status_text,
        status_emoji,
        status_expiration: status_expiration || 0,
      },
    }),
    timeout: 30,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error('Slack Status API error: ' + JSON.stringify(result));
}


/***********************
 * USAGE EXAMPLES
 ***********************/

// Example 1: Set vacation status with 'away' presence (default)
function setVacationStatus() {
  setStatusOverride(168, 'On Vacation', '🏖️', 'away');
}

// Example 2: Set vacation status but appear 'auto' (active if using Slack)
function setVacationButActive() {
  setStatusOverride(168, 'Working Remotely from Beach', '🏝️', 'auto');
}

// Example 3: Set vacation without changing presence at all
function setVacationNoPresence() {
  setStatusOverride(168, 'Out of Office', '✈️', null);
}

/***********************
 * OPTIONAL: ONE-TIME TEST
 ***********************/
function testSlackStatus() {
  const token = PropertiesService.getScriptProperties().getProperty(PROP_USER_TOKEN);
  updateSlackStatus(token, {
    text: 'Testing from Apps Script',
    emoji: ':robot_face:',
    presence: 'auto',
    expirationTs: 0,
  });
}
