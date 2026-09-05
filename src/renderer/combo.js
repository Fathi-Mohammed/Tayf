import { t } from './i18n.js';
import { escapeHtml } from './format.js';

const BLUR_DELAY_MS = 130;

export function createCombo(inputId, listId, onPick) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  let options = [];
  let selectedId = '';
  let highlighted = 0;
  let open = false;
  let query = '';

  const labelOf = (id) => {
    const option = options.find((candidate) => candidate.id === id);
    return option ? option.label : '';
  };

  const matching = () => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  };

  function draw() {
    if (!open) {
      list.style.display = 'none';
      return;
    }

    const visible = matching();
    if (highlighted >= visible.length) highlighted = Math.max(0, visible.length - 1);

    list.style.display = 'block';
    list.innerHTML = visible.length
      ? visible
          .map(
            (option, index) =>
              `<div class="citem${index === highlighted ? ' on' : ''}" ` +
              `data-id="${escapeHtml(option.id)}">${escapeHtml(option.label)}</div>`
          )
          .join('')
      : t("<div class=\"cempty\">مفيش نتايج</div>");

    const element = list.children[highlighted];
    if (element && element.scrollIntoView) element.scrollIntoView({ block: 'nearest' });
  }

  function openList() {
    open = true;
    query = '';
    highlighted = Math.max(0, options.findIndex((option) => option.id === selectedId));
    draw();
  }

  function closeList() {
    open = false;
    query = '';
    input.value = labelOf(selectedId);
    draw();
  }

  function pick(id) {
    const changed = id !== selectedId;
    selectedId = id;
    input.value = labelOf(id);
    closeList();
    if (changed && onPick) onPick(id);
  }

  input.addEventListener('focus', () => {
    openList();
    input.select();
  });
  input.addEventListener('blur', () => setTimeout(closeList, BLUR_DELAY_MS));
  input.addEventListener('input', () => {
    query = input.value;
    open = true;
    highlighted = 0;
    draw();
  });

  input.addEventListener('keydown', (event) => {
    const visible = matching();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      if (!open) openList();
      else {
        highlighted += 1;
        draw();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      highlighted = Math.max(0, highlighted - 1);
      draw();
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      event.stopPropagation();
      if (visible[highlighted]) pick(visible[highlighted].id);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      closeList();
    } else if (event.key === 'Tab' && open && visible[highlighted]) {
      pick(visible[highlighted].id);
    }
  });

  list.addEventListener('mousedown', (event) => {
    const option = event.target.closest('.citem');
    if (!option) return;
    event.preventDefault();
    pick(option.dataset.id);
  });

  return {
    setOptions(nextOptions, preferredId) {
      options = nextOptions || [];
      const hasPreferred =
        preferredId != null && options.some((option) => option.id === preferredId);
      selectedId = hasPreferred ? preferredId : (options[0] ? options[0].id : '');
      input.value = labelOf(selectedId);
    },
    get value() {
      return selectedId;
    },
    setValue(id) {
      if (!options.some((option) => option.id === id)) return;
      selectedId = id;
      input.value = labelOf(id);
    }
  };
}
