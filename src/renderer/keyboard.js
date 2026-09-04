import elements from './elements.js';
import { state, selectedRow } from './state.js';
import { goTo, activeScreenName, repaint } from './navigation.js';
import { moveSelection } from './list-view.js';
import { cycleView, setView, setBoardFilter } from './board.js';
import {
  isOpen as pickerIsOpen,
  openPicker,
  closePicker,
  movePicker,
  choosePicker,
  installBoardPicker
} from './board-picker.js';
import { setFlash } from './chrome.js';
import { QUICK_DATES } from './dates.js';
import { FILTERS, setFilter, backToTaskList } from './screens/task-list.js';
import { transitionContext, chooseTransition } from './screens/transitions.js';
import { submit as submitTransitionForm, copyEstimateIntoWorklog } from './screens/transition-form.js';
import { submit as submitCompose, currentDetail as composeDetail, isEditing } from './screens/compose.js';
import { currentDetail as viewedDetail } from './screens/item-view.js';
import {
  save as saveSettings,
  showTabByNumber,
  onConnectionTab
} from './screens/settings.js';
import {
  ACTIONS,
  isOpen as menuIsOpen,
  openMenu,
  closeMenu,
  moveHighlight,
  highlightedAction,
  runAction
} from './action-menu.js';

function hasCommandModifier(event) {
  return event.ctrlKey || event.metaKey;
}

function physicalKey(event) {
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  return String(event.key || '').toLowerCase();
}

function openInJira(item) {
  if (!item || !item.key) return;
  window.tayf.openItem(item.key);
  window.tayf.close();
}

function focusSearch() {
  elements.search.focus();
  elements.search.select();
}

function handleSettings(event, key) {
  if (event.key === 'Escape') {
    event.preventDefault();
    window.tayf.close();
    return true;
  }
  if (hasCommandModifier(event) && /^[0-9]$/.test(key)) {
    if (showTabByNumber(Number(key))) event.preventDefault();
    return true;
  }
  if (event.key === 'Enter' && onConnectionTab()) {
    event.preventDefault();
    saveSettings();
    return true;
  }
  return true;
}

function handleItemView(event, key) {
  const detail = viewedDetail();

  if (event.key === 'Escape') {
    event.preventDefault();
    backToTaskList(detail && detail.key);
    return true;
  }
  if (key === 'e' && detail) {
    event.preventDefault();
    goTo('compose', { intent: 'edit', item: detail });
    return true;
  }
  if (key === 's' && detail) {
    event.preventDefault();
    goTo('transitions', { item: detail });
    return true;
  }
  if (hasCommandModifier(event) && key === 'o') {
    event.preventDefault();
    openInJira(detail);
    return true;
  }
  return true;
}

function handleTransitionForm(event, key) {
  if (event.key === 'Escape') {
    event.preventDefault();
    transitionContext.pending = null;
    goTo('transitions', { item: transitionContext.item }).then(focusSearch);
    return true;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    submitTransitionForm();
    return true;
  }
  if (event.altKey && key === '1') {
    event.preventDefault();
    copyEstimateIntoWorklog();
    return true;
  }
  if (hasCommandModifier(event) && key === 'o') {
    event.preventDefault();
    openInJira(transitionContext.item);
    return true;
  }
  return true;
}

function handleCompose(event, key) {
  if (event.key === 'Escape') {
    event.preventDefault();
    backToTaskList();
    return true;
  }
  if (event.key === 'Enter') {
    if (event.target === elements.cdescin && !hasCommandModifier(event)) return true;
    event.preventDefault();
    submitCompose();
    return true;
  }
  if (hasCommandModifier(event) && key === 'o' && isEditing()) {
    event.preventDefault();
    openInJira(composeDetail());
    return true;
  }
  if (hasCommandModifier(event) && key === 'k') {
    event.preventDefault();
    focusSearch();
    return true;
  }
  if (event.altKey && /^[1-5]$/.test(key)) {
    const quick = QUICK_DATES.find((candidate) => candidate.key === key);
    if (quick) {
      event.preventDefault();
      elements.cdue.value = quick.label;
      elements.cdue.dispatchEvent(new Event('input'));
      elements.cdue.focus();
    }
    return true;
  }
  return true;
}

function handleActionMenu(event, key) {
  if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    closeMenu();
    return true;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveHighlight(1);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlight(-1);
    return true;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    runAction(highlightedAction().id);
    return true;
  }

  const shortcut = ACTIONS.find((action) => action.shortcut.toLowerCase() === key);
  event.preventDefault();
  if (shortcut) runAction(shortcut.id);
  return true;
}

function handleBoardPicker(event) {
  if (event.key === 'ArrowDown') movePicker(1);
  else if (event.key === 'ArrowUp') movePicker(-1);
  else if (event.key === 'Enter') choosePicker();
  else closePicker();
  event.preventDefault();
  return true;
}

function handleBoardKeys(event, key) {
  if (hasCommandModifier(event) && key === 'b') {
    event.preventDefault();
    openPicker();
    return true;
  }
  if (hasCommandModifier(event) && key === 'l') {
    event.preventDefault();
    cycleView();
    return true;
  }
  return false;
}

function handleList(event, key, screen) {
  const onTaskList = screen === 'tasks';

  if (onTaskList && handleBoardKeys(event, key)) return true;

  if (onTaskList && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
    event.preventDefault();
    openMenu();
    return true;
  }

  if (onTaskList && event.altKey && /^[1-4]$/.test(key)) {
    event.preventDefault();
    setFilter(FILTERS[parseInt(key, 10) - 1]);
    return true;
  }

  if (onTaskList && hasCommandModifier(event) && key === 'd' && state.rows.length) {
    event.preventDefault();
    goTo('itemView', { item: selectedRow() });
    return true;
  }

  if (onTaskList && event.key === 'Tab' && !event.shiftKey && state.rows.length) {
    event.preventDefault();
    goTo('transitions', { item: selectedRow() });
    return true;
  }

  if (hasCommandModifier(event) && key === 'k') {
    event.preventDefault();
    focusSearch();
    return true;
  }

  if (hasCommandModifier(event) && key === 'o') {
    event.preventDefault();
    openInJira(onTaskList ? selectedRow() : transitionContext.item);
    return true;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    if (onTaskList) window.tayf.close();
    else backToTaskList(transitionContext.item && transitionContext.item.key);
    return true;
  }

  if (event.key === 'ArrowDown' || (hasCommandModifier(event) && key === 'j')) {
    event.preventDefault();
    closeMenu();
    moveSelection(1);
    repaint();
    return true;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    closeMenu();
    moveSelection(-1);
    repaint();
    return true;
  }

  if (event.key === 'Enter' && state.rows.length) {
    event.preventDefault();
    if (onTaskList) goTo('itemView', { item: selectedRow() });
    else chooseTransition(selectedRow());
    return true;
  }

  return false;
}

const SCREEN_HANDLERS = {
  settings: handleSettings,
  itemView: handleItemView,
  transitionForm: handleTransitionForm,
  compose: handleCompose
};

export function installKeyboard() {
  document.addEventListener('keydown', (event) => {
    const key = physicalKey(event);

    if (hasCommandModifier(event) && key === 'q') {
      window.tayf.quit();
      return;
    }

    const screen = activeScreenName();
    const handler = SCREEN_HANDLERS[screen];
    if (handler) {
      handler(event, key);
      return;
    }

    if (hasCommandModifier(event) && key === 'n') {
      event.preventDefault();
      goTo('compose', { intent: 'create', prefillTitle: elements.search.value.trim() });
      return;
    }

    if (hasCommandModifier(event) && key === 'm') {
      event.preventDefault();
      goTo('compose', { intent: 'create', preset: 'meeting' });
      return;
    }

    if (pickerIsOpen()) {
      handleBoardPicker(event);
      return;
    }

    if (menuIsOpen()) {
      handleActionMenu(event, key);
      return;
    }

    handleList(event, key, screen);
  });

  elements.search.addEventListener('input', () => {
    closeMenu();
    closePicker();
    state.selectedIndex = 0;
    repaint();
  });

  elements.toasts.addEventListener('click', (event) => {
    if (!event.target.closest('[data-dismiss="failure"]')) return;
    state.workspace.failure = null;
    window.tayf.clearFailure();
    repaint();
  });

  elements.filters.addEventListener('click', (event) => {
    const chip = event.target.closest('.fil');
    if (chip) setFilter(chip.dataset.f);
  });

  elements.views.addEventListener('click', (event) => {
    const button = event.target.closest('.vbtn');
    if (button) setView(button.dataset.v);
  });

  installBoardPicker(setBoardFilter);
}

export { setFlash };
