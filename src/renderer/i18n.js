import english from './translations.js';

let language = 'ar';

export function setLanguage(value) {
  language = value === 'en' ? 'en' : 'ar';
  return language;
}

export function getLocale() {
  return language === 'en' ? 'en-US' : 'ar-EG';
}

// Interpolate once so braces in task titles or other user data remain untouched.
export function t(source, values = []) {
  const translated = language === 'en' ? (english[source] ?? source) : source;
  return translated.replace(/\{(\d+)\}/g, (match, index) =>
    index < values.length ? String(values[index]) : match
  );
}

export function translateDocument(root = document.documentElement) {
  root.lang = language;
  root.dir = language === 'en' ? 'ltr' : 'rtl';

  // Run on the static shell before rendering any Jira content or user input.
  function translate(node) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      const key = text.trim().replace(/\s+/g, ' ');
      if (Object.hasOwn(english, key)) {
        node.textContent = text.replace(text.trim(), t(key));
      }
      return;
    }
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE'].includes(node.tagName)) return;
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      if (node.hasAttribute(attribute)) node.setAttribute(attribute, t(node.getAttribute(attribute)));
    }
    node.childNodes.forEach(translate);
  }
  translate(root);
}
