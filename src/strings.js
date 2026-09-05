'use strict';

const ERROR_TEXT_AR = {
  'no-connection': 'مفيش اتصال بالنت أو اسم الموقع غلط.',
  'bad-credentials': 'الإيميل أو الـ API Token غلط.',
  forbidden: 'الحساب مالوش صلاحية للعملية دي.',
  'not-found': 'المسار مش موجود — يمكن اسم الموقع غلط.',
  'rate-limited': 'Jira قال استنى شوية (rate limit). جرّب كمان لحظة.',
  'jira-unavailable': 'Jira نفسه واقع دلوقتي.',
  'unexpected-response': 'Jira رجّع رد مش متوقع.',
  rejected: 'Jira رفض الطلب:',
  'not-configured': 'مفيش إعدادات — افتح الإعدادات وحطّ بيانات Jira.',
  'save-failed': 'مقدرناش نحفظ الإعدادات.',
  'site-required': 'اكتب اسم الموقع',
  'email-required': 'اكتب الإيميل',
  'token-required': 'اكتب الـ API Token',
  'worklog-required':
    'جيرا عايز وقت مسجّل على التاسك. اختار الحالة تاني وهيسألك عن الوقت المرة دي.'
};

const APP_NAME = 'طيف';

const TRAY_TEXT_AR = {
  appName: APP_NAME,
  appTitle: (version, dev) => `${APP_NAME} ${version}${dev ? ' (تطوير)' : ''}`,
  needsSetup: 'محتاج إعداد',
  connectionProblem: 'فيه مشكلة في الاتصال',
  itemCount: (count) => `${count} تاسك`,
  open: 'افتح',
  newItem: 'تاسك جديدة',
  refreshNow: 'حدّث دلوقتي',
  hotkey: 'الاختصار',
  settings: 'الإعدادات',
  errorLog: 'سجل الأخطاء',
  openConfigFile: 'افتح ملف الإعدادات',
  restart: 'إعادة تشغيل',
  quit: 'خروج',
  startWithWindows: 'يشتغل مع ويندوز',
  startWithMac: 'يشتغل مع الماك',
  startWithLinux: 'يشتغل مع لينكس',
  nudges: 'النكزات',
  nudgeSnoozeHour: 'سكّت ساعة',
  nudgeSnoozeTomorrow: 'سكّت لحد بكرة',
  nudgeWake: 'رجّعها تنكز',
  nudgeSnoozedUntil: (time) => `ساكتة لحد ${time}`,
  checkUpdates: 'شوف لو فيه تحديث',
  checkingUpdates: 'بيدوّر على تحديث…',
  downloadingUpdate: 'بينزّل التحديث…',
  updateReady: (version) => `تحديث ${version} جاهز — سطّبه دلوقتي`
};

function count(amount, one, two, few, many) {
  if (amount === 1) return one;
  if (amount === 2) return two;
  return `${amount} ${amount <= 10 ? few : many}`;
}

function spellDays(days) {
  return count(days, 'يوم', 'يومين', 'أيام', 'يوم');
}

function spellHours(hours) {
  return count(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
}

function spellMinutes(minutes) {
  return count(minutes, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة');
}

const PAST_THE_HOUR = { 15: 'وربع', 20: 'وتلت', 30: 'ونص' };
const SHORT_OF_THE_HOUR = { 40: 'إلا تلت', 45: 'إلا ربع' };

function spell(minutes) {
  if (minutes < 60) return spellMinutes(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return spellDays(Math.floor(hours / 24));

  const rest = minutes % 60;
  if (!rest) return spellHours(hours);
  if (PAST_THE_HOUR[rest]) return `${spellHours(hours)} ${PAST_THE_HOUR[rest]}`;
  if (SHORT_OF_THE_HOUR[rest]) return `${spellHours(hours + 1)} ${SHORT_OF_THE_HOUR[rest]}`;

  return `${spellHours(hours)} و${spellMinutes(rest)}`;
}

const NUDGE_TEXT_AR = {
  stillOnIt: (key, minutes) => ({
    title: `${key} لسه شغال عليها؟`,
    body: `بقالها ${spell(minutes)} In Progress. لو خلصت اقفلها، ولو لسه سيبها وكمّل.`
  }),
  nothingInProgress: (count) => ({
    title: 'مفيش تاسك شغال عليها',
    body: `عندك ${count} تاسك مفتوحة ومفيش ولا واحدة In Progress. دوس هنا وحرّك واحدة.`
  }),
  overdue: (key, days) => ({
    title: `${key} عدّى معادها`,
    body: `كان المفروض تتقفل من ${spellDays(days)}. لو خلصت اقفلها، ولو محتاجة وقت غيّر التاريخ.`
  })
};

const NOTIFICATION_TEXT_AR = {
  actionFailedTitle: (key) => (key ? `${key} ماتنفذش` : 'الأكشن ماتنفذش'),
  transitionFailed: (status, reason) => `مانتقلش لـ ${status} — ${reason}`,
  updateFailed: (reason) => `ماتعدّلتش — ${reason}`,
  createFailed: (reason) => `التاسك ماتعملتش — ${reason}`
};

function jiraComplaints(detail) {
  const text = String(detail || '').trim();
  if (!text) return '';

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return text;
  }

  return [
    ...(Array.isArray(body.errorMessages) ? body.errorMessages : []),
    ...Object.values(body.errors || {})
  ]
    .map((one) => String(one).trim())
    .filter(Boolean)
    .join('  ·  ');
}

function errorText(error) {
  if (!error) return ERROR_TEXT['unexpected-response'];
  const known = ERROR_TEXT[error.code];
  if (!known) return error.message || ERROR_TEXT['unexpected-response'];
  if (error.code === 'jira-unavailable' && error.status) {
    return `${known} (${error.status})`;
  }
  if (error.code === 'unexpected-response') {
    const complaints = jiraComplaints(error.detail);
    if (complaints) return `${ERROR_TEXT.rejected} ${complaints}`;
  }
  return known;
}

let language = 'ar';

function setLanguage(value) {
  language = value === 'en' ? 'en' : 'ar';
}

function getLocale() {
  return language === 'en' ? 'en-US' : 'ar-EG';
}

// Getters keep existing consumers in sync when the preference changes.
function localized(arabic, english) {
  return Object.defineProperties({}, Object.fromEntries(
    Object.keys(arabic).map((key) => [key, {
      enumerable: true,
      get: () => language === 'en' ? english[key] : arabic[key]
    }])
  ));
}

const ERROR_TEXT = localized(ERROR_TEXT_AR, {
  'no-connection': 'No internet connection, or the site name is incorrect.',
  'bad-credentials': 'The email or API Token is incorrect.',
  forbidden: 'Your account does not have permission for this action.',
  'not-found': 'The path was not found — check the site name.',
  'rate-limited': 'Jira is rate limiting requests. Try again in a moment.',
  'jira-unavailable': 'Jira is currently unavailable.',
  'unexpected-response': 'Jira returned an unexpected response.',
  rejected: 'Jira rejected the request:',
  'not-configured': 'Open Settings and enter your Jira connection details.',
  'save-failed': 'Could not save settings.',
  'site-required': 'Enter the site name',
  'email-required': 'Enter your email',
  'token-required': 'Enter the API Token',
  'worklog-required': 'Jira requires logged time. Choose the status again to enter time spent.'
});

const TRAY_TEXT = localized(TRAY_TEXT_AR, {
  appName: 'Tayf',
  appTitle: (version, dev) => `Tayf ${version}${dev ? ' (Development)' : ''}`,
  needsSetup: 'Setup required',
  connectionProblem: 'Connection problem',
  itemCount: (count) => `${count} ${count === 1 ? 'task' : 'tasks'}`,
  open: 'Open',
  newItem: 'New task',
  refreshNow: 'Refresh now',
  hotkey: 'Shortcut',
  settings: 'Settings',
  errorLog: 'Error log',
  openConfigFile: 'Open settings file',
  restart: 'Restart',
  quit: 'Quit',
  startWithWindows: 'Launch with Windows',
  startWithMac: 'Launch with macOS',
  startWithLinux: 'Launch with Linux',
  nudges: 'Nudges',
  nudgeSnoozeHour: 'Snooze for an hour',
  nudgeSnoozeTomorrow: 'Snooze until tomorrow',
  nudgeWake: 'Resume nudges',
  nudgeSnoozedUntil: (time) => `Snoozed until ${time}`,
  checkUpdates: 'Check for updates',
  checkingUpdates: 'Checking for updates…',
  downloadingUpdate: 'Downloading update…',
  updateReady: (version) => `Update ${version} is ready — install now`
});

const NUDGE_TEXT = localized(NUDGE_TEXT_AR, {
  stillOnIt: (key, minutes) => ({
    title: `${key} — still working on it?`,
    body: `In Progress for ${minutes} minutes. Close it if you are done, or keep going.`
  }),
  nothingInProgress: (count) => ({
    title: 'No task in progress',
    body: `You have ${count} open ${count === 1 ? 'task' : 'tasks'} and none In Progress. Click here to start one.`
  }),
  overdue: (key, days) => ({
    title: `${key} is overdue`,
    body: `Due ${days} ${days === 1 ? 'day' : 'days'} ago. Close it if you are done, or update the due date.`
  })
});

const NOTIFICATION_TEXT = localized(NOTIFICATION_TEXT_AR, {
  actionFailedTitle: (key) => key ? `${key} — action failed` : 'Action failed',
  transitionFailed: (status, reason) => `Could not move to ${status} — ${reason}`,
  updateFailed: (reason) => `Could not update the task — ${reason}`,
  createFailed: (reason) => `Could not create the task — ${reason}`
});

module.exports = {
  ERROR_TEXT, TRAY_TEXT, NUDGE_TEXT, NOTIFICATION_TEXT,
  errorText, jiraComplaints, setLanguage, getLocale
};
