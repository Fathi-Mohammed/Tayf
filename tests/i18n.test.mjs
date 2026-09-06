import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, getLocale, t, translateDocument } from '../src/renderer/i18n.js';
import english from '../src/renderer/translations.js';
import nativeStrings from '../src/strings.js';

// Match startup: preferences load before modules initialize their labels.
setLanguage('en');
const { QUICK_DATES, DATE_WORDS, parseDueDate, parseEstimate } =
  await import('../src/renderer/dates.js');
const TUESDAY = new Date(2026, 8, 1, 12);

test('English quick dates and completion words remain usable as date input', () => {
  assert.equal(QUICK_DATES[0].label, 'Today');
  for (const word of [...DATE_WORDS, ...QUICK_DATES.map((quick) => quick.label)]) {
    const parsed = parseDueDate(word, TUESDAY);
    assert.equal(parsed.ok, true, word);
    assert.doesNotMatch(parsed.label, /[\u0600-\u06ff]/);
  }
  assert.equal(parseDueDate('Day after tomorrow', TUESDAY).value, '2026-09-03');
  assert.equal(parseDueDate('بكرة', TUESDAY).value, '2026-09-02');
  assert.equal(parseEstimate('bad').label, 'Enter minutes or a duration such as 4h, 2d, or 1d 4h');
});

test('translations preserve interpolation values and unknown labels', () => {
  assert.equal(t('اتعملت · <b>{0}</b>', ['TASK-{1}']), 'Created · <b>TASK-{1}</b>');
  assert.equal(t('Unknown label'), 'Unknown label');
  assert.equal(t('عام'), 'General');
  const placeholders = (text) => [...text.matchAll(/\{\d+\}/g)].map(([key]) => key).sort();
  for (const [source, translation] of Object.entries(english)) {
    assert.deepEqual(placeholders(translation), placeholders(source), source);
  }
});

test('the static shell translates without replacing controls or changing input values', () => {
  const label = { nodeType: 3, textContent: '  عام  ' };
  const input = {
    nodeType: 1, tagName: 'INPUT', value: 'عنوان من المستخدم', childNodes: [],
    attributes: { placeholder: 'دوّر على تاسك' },
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  const root = { ...input, tagName: 'HTML', attributes: {}, childNodes: [label, input] };
  translateDocument(root);
  assert.equal(root.lang, 'en');
  assert.equal(root.dir, 'ltr');
  assert.equal(label.textContent, '  General  ');
  assert.equal(input.attributes.placeholder, 'Search tasks');
  assert.equal(input.value, 'عنوان من المستخدم');
  assert.equal(root.childNodes[1], input);
});

test('Arabic and unsupported preferences use the original text and RTL layout', () => {
  try {
    for (const language of ['ar', 'fr', undefined]) {
      setLanguage(language);
      assert.equal(t('عام'), 'عام');
      assert.equal(getLocale(), 'ar-EG');
      const root = { nodeType: 1, tagName: 'HTML', childNodes: [], hasAttribute: () => false };
      translateDocument(root);
      assert.equal(root.lang, 'ar');
      assert.equal(root.dir, 'rtl');
    }
  } finally {
    setLanguage('en');
  }
});

test('tray labels, errors, and notifications follow language changes in both directions', () => {
  const original = nativeStrings.TRAY_TEXT.settings;
  try {
    nativeStrings.setLanguage('en');
    assert.equal(nativeStrings.TRAY_TEXT.settings, 'Settings');
    assert.equal(nativeStrings.errorText({ code: 'email-required' }), 'Enter your email');
    assert.equal(nativeStrings.TRAY_TEXT.itemCount(1), '1 task');
    assert.match(nativeStrings.NUDGE_TEXT.stillOnIt('TASK-1', 10).title, /still working/);
    assert.match(nativeStrings.NOTIFICATION_TEXT.createFailed('reason'), /reason/);
    for (const name of ['ERROR_TEXT', 'TRAY_TEXT', 'NUDGE_TEXT', 'NOTIFICATION_TEXT']) {
      for (const value of Object.values(nativeStrings[name])) assert.notEqual(value, undefined);
    }
    nativeStrings.setLanguage('ar');
    assert.equal(nativeStrings.TRAY_TEXT.settings, original);
    nativeStrings.setLanguage('invalid');
    assert.equal(nativeStrings.TRAY_TEXT.settings, original);
  } finally {
    nativeStrings.setLanguage('ar');
  }
});
