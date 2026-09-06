import { t } from '../i18n.js';
import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, paintBanners, setContext, setFlash } from '../chrome.js';
import { backToTaskList } from './task-list.js';
import { APPEARANCES, THEMES, FONTS, SCALES, applyPreferences } from '../appearance.js';
import { createSelect } from '../select.js';

const CLOSE_DELAY_MS = 900;
const TABS = ['conn', 'nudge', 'gen', 'appear'];
const PANES = { conn: 'pconn', nudge: 'pnudge', gen: 'pgen', appear: 'pappear' };
const AUTO_START_HINT = { darwin: t("يفتح لوحده مع الماك.") };
const DAY_LETTERS = [t("ح"), t("ن"), t("ث"), t("ر"), t("خ"), t("ج"), t("س")];
const DAY_NAMES = [t("الأحد"), t("الاتنين"), t("التلات"), t("الأربع"), t("الخميس"), t("الجمعة"), t("السبت")];
const EVERY_CHOICES = [1, 5, 10, 15, 20, 30, 45, 60];
const IDLE_CHOICES = [1, 3, 5, 10, 15, 20, 30];
const CHECK_CHOICES = [1, 5, 15, 30, 45, 60, 90, 120, 180, 240];
const OVERDUE_CHOICES = [1, 2, 3, 5, 7];
const IN_PROGRESS = 'indeterminate';
const LANGUAGES = [
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' }
];

let saving = false;
let activeTab = 'conn';
let savedLanguage = 'ar';

function setNote(text, className) {
  elements.snote.textContent = text || '';
  elements.snote.className = className || '';
}

// الاختيارات كلها بتوصل للقايمة على شكل { id, label } والـ id نص دايماً،
// فالأرقام بتترجع لأرقام عند الحفظ.
const asHotkeys = (choices) =>
  (choices || []).map((choice) => ({ id: choice.accelerator, label: choice.label }));

const asNumbers = (values, unit) =>
  values.map((value) => ({ id: String(value), label: `${value} ${unit}` }));

const countOfStatuses = (count) => (count > 10 ? t("{0} حالة", [count]) : t("{0} حالات", [count]));

const selects = {
  language: createSelect('slanguage', {
    onChange: saveLanguage
  }),
  hotkey: createSelect('shotkey', {
    onChange: (value) => savePreference({ toggleHotkey: value })
  }),
  addKey: createSelect('saddkey', {
    onChange: (value) => savePreference({ composeHotkey: value })
  }),
  theme: createSelect('stheme', {
    onChange: (value) => savePreference({ theme: value })
  }),
  font: createSelect('sfont', {
    onChange: (value) => savePreference({ font: value })
  }),
  scale: createSelect('sscale', {
    onChange: (value) => savePreference({ uiScale: Number(value) })
  }),
  every: createSelect('snudgeevery', {
    onChange: (value) => saveNudge({ everyMinutes: Number(value) })
  }),
  idle: createSelect('snudgeidle', {
    onChange: (value) => saveNudge({ idleMinutes: Number(value) })
  }),
  checkEvery: createSelect('snudgecheckevery', {
    onChange: (value) => saveNudge({ checkMinutes: Number(value) })
  }),
  overdueDays: createSelect('snudgeoverduedays', {
    onChange: (value) => saveNudge({ overdueDays: Number(value) })
  }),
  statuses: createSelect('snudgestatuses', {
    multiple: true,
    searchable: true,
    emptyLabel: t("مفيش حالات لسه"),
    // أسامي الحالات إنجليزي جوه واجهة عربية — تلاتة منهم ورا بعض بيبقوا
    // مقروئين بالعافية، فبنعد بدل ما نسرد.
    summary: (names) => (names.length > 2 ? countOfStatuses(names.length) : names.join(t("، "))),
    onChange: (next) => {
      if (!next.length) {
        setNote(t("لازم حالة واحدة على الأقل تعني إنك شغال."), 'bad');
        return false;
      }
      saveNudge({ workingStatuses: next });
      return true;
    }
  })
};

const languageTrigger = elements.slanguage.querySelector('.sel-trigger');
languageTrigger.id = 'slanguage-trigger';

function paintAppearance(current) {
  const chosen = APPEARANCES.includes(current) ? current : 'system';
  elements.sappearance.querySelectorAll('input').forEach((input) => {
    input.checked = input.value === chosen;
  });
}

// مفيش اختيار محفوظ يعني كل الحالات محسوبة — نفس اللي كان بيعمله الشكل القديم.
function paintStatuses(statuses, working) {
  const names = (statuses || [])
    .filter((status) => status.category === IN_PROGRESS)
    .map((status) => status.name);
  const chosen = Array.isArray(working) && working.length ? working : names;

  selects.statuses.setOptions(
    names.map((name) => ({ id: name, label: name })),
    chosen
  );
}

// شيكبوكس حقيقي مخفي جوه كل يوم — Tab بيوصله والمسافة بتعلّمه، من غير كود كيبورد.
//
// الأيام بتتبني مرة واحدة وبعد كده بنحدّث الحالة بس. كل حفظ بيعيد الرسم، ولو
// كنا بنعيد بناء الـ HTML كان اليوم اللي إنت واقف عليه هيتشال من الصفحة
// والفوكس هيقع على body وإنت لسه بتعلّم.
function paintDays(days) {
  if (!elements.snudgedays.children.length) {
    elements.snudgedays.innerHTML = DAY_LETTERS.map(
      (letter, index) =>
        `<label class="sday" title="${DAY_NAMES[index]}">` +
        `<input type="checkbox" value="${index}" aria-label="${DAY_NAMES[index]}" />` +
        `<span>${letter}</span></label>`
    ).join('');
  }

  elements.snudgedays.querySelectorAll('input').forEach((input) => {
    input.checked = days.includes(Number(input.value));
  });
}

function chosenDays() {
  return [...elements.snudgedays.querySelectorAll('input:checked')].map((input) =>
    Number(input.value)
  );
}

function paintPreferences(preferences) {
  savedLanguage = preferences.language === 'en' ? 'en' : 'ar';
  selects.language.setOptions(LANGUAGES, savedLanguage);
  selects.hotkey.setOptions(asHotkeys(preferences.toggleChoices), preferences.toggleHotkey);
  selects.addKey.setOptions(asHotkeys(preferences.composeChoices), preferences.composeHotkey);
  elements.sauto.checked = !!preferences.autoStart;
  elements.sautotext.textContent =
    AUTO_START_HINT[window.tayf.platform] || t("يفتح لوحده مع الويندوز.");

  const applied = applyPreferences(preferences);
  paintAppearance(applied.appearance);
  selects.theme.setOptions(
    THEMES.map((theme) => ({ id: theme.value, label: theme.label, dot: theme.value })),
    applied.theme
  );
  selects.font.setOptions(
    FONTS.map((font) => ({ id: font.value, label: font.label })),
    applied.font
  );
  selects.scale.setOptions(
    SCALES.map((scale) => ({ id: String(scale.value), label: scale.label })),
    String(preferences.uiScale || 1)
  );

  const nudges = preferences.nudges || {};
  elements.snudge.checked = !!nudges.enabled;
  selects.every.setOptions(asNumbers(EVERY_CHOICES, t("دقيقة")), String(nudges.everyMinutes));
  selects.idle.setOptions(asNumbers(IDLE_CHOICES, t("دقيقة")), String(nudges.idleMinutes));
  elements.snudgestart.value = nudges.workStart || '';
  elements.snudgeend.value = nudges.workEnd || '';
  elements.snudgecheck.checked = !!nudges.checkEnabled;
  selects.checkEvery.setOptions(asNumbers(CHECK_CHOICES, t("دقيقة")), String(nudges.checkMinutes));
  elements.snudgeoverdue.checked = !!nudges.overdueEnabled;
  selects.overdueDays.setOptions(asNumbers(OVERDUE_CHOICES, t("يوم")), String(nudges.overdueDays));
  paintDays(nudges.workDays || []);
}

function refused(requested, registered, choices) {
  if (!requested || requested === registered) return null;
  const fallback = (choices || []).find((choice) => choice.accelerator === registered);
  return t("الاختصار ده محجوز لبرنامج تاني — طيف خد {0}", [fallback ? fallback.label : registered]);
}

async function savePreference(patch) {
  const preferences = await window.tayf.savePreferences(patch);
  paintPreferences(preferences);

  const problem =
    refused(patch.toggleHotkey, preferences.toggleHotkey, preferences.toggleChoices) ||
    refused(patch.composeHotkey, preferences.composeHotkey, preferences.composeChoices);

  if (problem) {
    setNote(problem, 'bad');
    return;
  }
  setNote('', '');
  setFlash(t("اتحفظ"), 'done');
}

export function showTab(name) {
  if (!PANES[name]) return;
  activeTab = name;

  TABS.forEach((tab) => elements[PANES[tab]].classList.toggle('on', tab === name));
  elements.snav.querySelectorAll('.snavitem').forEach((item) =>
    item.classList.toggle('on', item.dataset.t === name)
  );

  const first = elements[PANES[name]].querySelector('input, select, .sel-trigger');
  if (first) {
    first.focus();
    if (first.select) first.select();
  }
}

export function showTabByNumber(number) {
  const name = TABS[number - 1];
  if (name) showTab(name);
  return !!name;
}

export function onConnectionTab() {
  return activeTab === 'conn';
}

export async function save() {
  if (saving) return;
  saving = true;
  setNote(t("بيحفظ وبيجرّب الاتصال…"), '');

  const response = await window.tayf.saveConfig({
    site: elements.ssite.value,
    email: elements.semail.value,
    token: elements.stoken.value
  });
  saving = false;

  if (response.error) {
    setNote(response.error, 'bad');
    return;
  }

  setNote(t("تمام — متصلين باسم {0}. الطبقة هتقفل دلوقتي.", [response.name || '']), 'good');
  elements.stoken.value = '';
  setTimeout(async () => {
    await backToTaskList();
    window.tayf.close();
  }, CLOSE_DELAY_MS);
}

export const settingsScreen = {
  name: 'settings',

  async enter() {
    setContext('');
    this.render();
    setNote('', '');

    const stored = await window.tayf.readConfig();
    elements.ssite.value = stored.site || '';
    elements.semail.value = stored.email || '';
    elements.stoken.value = '';
    elements.stoken.placeholder = stored.hasToken
      ? t("متحفوظ — سيبه فاضي لو مش هتغيّره")
      : t("الصق الـ API Token");

    paintPreferences(await window.tayf.readPreferences());

    const response = await window.tayf.statuses();
    paintStatuses(response.error ? [] : response.statuses, response.working);
    showTab(state.workspace.configured ? activeTab : 'conn');
  },

  render() {
    showLayout('settings');
    paintBanners();
    state.rows = [];
  }
};

elements.tokenlink.addEventListener('click', () => window.tayf.openTokenPage());
elements.snav.addEventListener('click', (event) => {
  const item = event.target.closest('.snavitem');
  if (item) showTab(item.dataset.t);
});
elements.sauto.addEventListener('change', () =>
  savePreference({ autoStart: elements.sauto.checked })
);
async function saveLanguage(language) {
  languageTrigger.disabled = true;
  try {
    await window.tayf.savePreferences({ language });
    window.sessionStorage.setItem('language-settings', 'gen');
    window.location.reload();
  } catch {
    selects.language.setValue(savedLanguage);
    languageTrigger.disabled = false;
    languageTrigger.focus();
    setNote(t('مقدرناش نحفظ الإعدادات.'), 'bad');
  }
}
elements.sappearance.addEventListener('change', (event) => {
  if (event.target.checked) savePreference({ appearance: event.target.value });
});

const saveNudge = (patch) => savePreference({ nudges: patch });

elements.snudge.addEventListener('change', () => saveNudge({ enabled: elements.snudge.checked }));
elements.snudgeoverdue.addEventListener('change', () =>
  saveNudge({ overdueEnabled: elements.snudgeoverdue.checked })
);
elements.snudgecheck.addEventListener('change', () =>
  saveNudge({ checkEnabled: elements.snudgecheck.checked })
);
elements.snudgestart.addEventListener('change', () => {
  if (elements.snudgestart.value) saveNudge({ workStart: elements.snudgestart.value });
});
elements.snudgeend.addEventListener('change', () => {
  if (elements.snudgeend.value) saveNudge({ workEnd: elements.snudgeend.value });
});
elements.snudgedays.addEventListener('change', () =>
  saveNudge({ workDays: chosenDays() })
);
