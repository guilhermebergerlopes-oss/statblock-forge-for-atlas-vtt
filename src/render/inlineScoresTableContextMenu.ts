import type { InlineScoresTableEdit } from '../statblocks/inlineScoresTableModel.ts';
import type { InlineScoresTableMenuAction } from '../statblocks/inlineScoresTableMenuModel.ts';

export interface InlineScoresTableContextMenuOptions {
  actions: readonly InlineScoresTableMenuAction[];
  point: { x: number; y: number };
  returnFocus?: HTMLElement | null;
  run: (edit: InlineScoresTableEdit) => Promise<void> | void;
}

const ICON_PATHS: Record<string, string[]> = {
  'panel-top-close': ['<rect x="3" y="3" width="18" height="7" rx="1"/>', '<path d="M12 14v7m-3-3 3 3 3-3"/>'],
  'panel-bottom-close': ['<rect x="3" y="14" width="18" height="7" rx="1"/>', '<path d="M12 10V3m-3 3 3-3 3 3"/>'],
  'arrow-up': ['<path d="m5 12 7-7 7 7M12 19V5"/>'],
  'arrow-down': ['<path d="m5 12 7 7 7-7M12 5v14"/>'],
  copy: ['<rect x="8" y="8" width="13" height="13" rx="2"/>', '<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'],
  'trash-2': ['<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>'],
  'panel-left-close': ['<rect x="3" y="3" width="18" height="18" rx="2"/>', '<path d="M8 3v18m8-12-3 3 3 3"/>'],
  'panel-right-close': ['<rect x="3" y="3" width="18" height="18" rx="2"/>', '<path d="M16 3v18M8 9l3 3-3 3"/>'],
  'arrow-left': ['<path d="m12 5-7 7 7 7M5 12h14"/>'],
  'arrow-right': ['<path d="m12 5 7 7-7 7m7-7H5"/>'],
  'arrow-down-a-z': ['<path d="M7 4v16m-3-3 3 3 3-3M14 6h6m-6 5h5m-5 5h4"/>', '<path d="M14 20h6"/>'],
  'arrow-up-z-a': ['<path d="M7 20V4m-3 3 3-3 3 3M14 18h6m-6-5h5m-5-5h4"/>', '<path d="M14 4h6"/>'],
  table: ['<rect x="3" y="4" width="18" height="16" rx="2"/>', '<path d="M3 10h18M9 4v16m6-10v10"/>'],
  'chevron-right': ['<path d="m9 18 6-6-6-6"/>'],
};

function appendIcon(slot: HTMLElement, name: string): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  // The icon fragments are trusted compile-time definitions, but build their
  // SVG nodes through the DOM API instead of parsing markup with innerHTML.
  for (const markup of ICON_PATHS[name] ?? []) {
    const match = /^<(path|rect)\s+([^>]+)\/>$/.exec(markup);
    if (!match) continue;
    const tagName = match[1];
    if (tagName !== 'path' && tagName !== 'rect') continue;
    const shape = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tagName);
    const attributes = /([a-z][a-z-]*)="([^"]*)"/g;
    for (const attribute of match[2].matchAll(attributes)) {
      const attributeName = attribute[1];
      const attributeValue = attribute[2];
      if (attributeName && attributeValue !== undefined) shape.setAttribute(attributeName, attributeValue);
    }
    svg.append(shape);
  }
  slot.append(svg);
}

function buttonItems(panel: HTMLElement): HTMLButtonElement[] {
  return Array.from(panel.querySelectorAll<HTMLButtonElement>(':scope > button[data-menu-item], :scope > .statblock-forge__table-menu-submenu-wrap > button[data-menu-item]'))
    .filter((button) => !button.disabled);
}

function hideSubmenus(panel: HTMLElement, except?: HTMLElement): void {
  for (const wrap of Array.from(panel.querySelectorAll<HTMLElement>(':scope > .statblock-forge__table-menu-submenu-wrap'))) {
    if (wrap === except) continue;
    const trigger = wrap.querySelector<HTMLButtonElement>(':scope > button');
    const submenu = wrap.querySelector<HTMLElement>(':scope > .statblock-forge__table-menu-panel');
    trigger?.setAttribute('aria-expanded', 'false');
    if (submenu) {
      submenu.hidden = true;
      hideSubmenus(submenu);
    }
  }
}

function setSubmenuOpen(trigger: HTMLButtonElement, wrap: HTMLElement, open: boolean): void {
  const panel = wrap.querySelector<HTMLElement>(':scope > .statblock-forge__table-menu-panel');
  if (!panel) return;
  const ownerPanel = wrap.parentElement?.closest<HTMLElement>('[data-menu-panel]');
  if (!open) {
    trigger.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    hideSubmenus(panel);
    return;
  }
  if (ownerPanel) hideSubmenus(ownerPanel, wrap);
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  panel.classList.toggle('is-open-left', panelRect.right > window.innerWidth - 8);
  const actualWidth = panelRect.width || 208;
  const actualHeight = panelRect.height || 240;
  const top = Math.max(8, Math.min(triggerRect.top - 4, window.innerHeight - actualHeight - 8));
  panel.setCssStyles({ top: `${top - wrap.getBoundingClientRect().top}px` });
  if (panel.classList.contains('is-open-left')) {
    panel.setCssStyles({ left: 'auto' });
    panel.setCssStyles({ right: `calc(100% - 4px)` });
  } else {
    panel.setCssStyles({ right: 'auto' });
    panel.setCssStyles({ left: 'calc(100% - 4px)' });
  }
  panel.setCssStyles({ minWidth: `${Math.max(180, Math.min(actualWidth, window.innerWidth - 16))}px` });
}

function createPanel(
  actions: readonly InlineScoresTableMenuAction[],
  run: InlineScoresTableContextMenuOptions['run'],
  close: (restore: boolean) => void,
  parentWrap?: HTMLElement,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'statblock-forge__table-menu-panel';
  panel.dataset.menuPanel = 'true';
  panel.setAttribute('role', 'menu');
  if (parentWrap) panel.hidden = true;

  for (const action of actions) {
    if (action.kind === 'separator') {
      const separator = document.createElement('div');
      separator.className = 'statblock-forge__table-menu-separator';
      separator.setAttribute('role', 'separator');
      panel.append(separator);
      continue;
    }

    const wrap = document.createElement('div');
    wrap.className = action.kind === 'submenu'
      ? 'statblock-forge__table-menu-submenu-wrap'
      : 'statblock-forge__table-menu-item-wrap';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `statblock-forge__table-menu-item${action.kind === 'item' && action.destructive ? ' is-destructive' : ''}`;
    button.dataset.menuItem = 'true';
    button.setAttribute('role', 'menuitem');
    button.disabled = action.kind === 'item' && Boolean(action.disabled);

    const leading = document.createElement('span');
    leading.className = 'statblock-forge__table-menu-leading';
    const icon = document.createElement('span');
    icon.className = 'statblock-forge__table-menu-icon';
    icon.setAttribute('aria-hidden', 'true');
    appendIcon(icon, action.icon);
    const label = document.createElement('span');
    label.className = 'statblock-forge__table-menu-label';
    label.textContent = action.label;
    leading.append(icon, label);
    button.append(leading);

    if (action.kind === 'submenu') {
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      const trailing = document.createElement('span');
      trailing.className = 'statblock-forge__table-menu-trailing';
      appendIcon(trailing, 'chevron-right');
      button.append(trailing);
      wrap.append(button);
      const child = createPanel(action.children, run, close, wrap);
      wrap.append(child);
      button.addEventListener('pointerenter', () => setSubmenuOpen(button, wrap, true));
      button.addEventListener('focus', () => {
        const owner = wrap.parentElement?.closest<HTMLElement>('[data-menu-panel]');
        if (owner) hideSubmenus(owner, wrap);
      });
      button.addEventListener('click', () => {
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        setSubmenuOpen(button, wrap, !isOpen);
        if (!isOpen) button.focus();
      });
    } else {
      if (action.command.type === 'sort-rows') button.dataset.sortItem = 'true';
      wrap.append(button);
      button.addEventListener('click', () => {
        if (button.disabled) return;
        close(false);
        const result = run(action.command);
        void Promise.resolve(result).catch((error: unknown) => {
          console.error('Statblock Forge table context-menu action failed.', error);
        });
      });
    }

    wrap.addEventListener('pointerenter', () => {
      const owner = wrap.parentElement?.closest<HTMLElement>('[data-menu-panel]');
      if (owner && action.kind !== 'submenu') hideSubmenus(owner);
    });
    panel.append(wrap);
  }
  return panel;
}

/** A small body-level menu portal, matching Atlas' menu hierarchy and keyboard affordances. */
export function openInlineScoresTableContextMenu(options: InlineScoresTableContextMenuOptions): () => void {
  const { actions, point, returnFocus, run } = options;
  const root = document.createElement('div');
  root.className = 'statblock-forge__table-menu-root';
  root.setAttribute('role', 'presentation');
  const panel = createPanel(actions, async (edit) => {
    try {
      await run(edit);
    } finally {
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    }
  }, () => close(false));
  root.append(panel);
  document.body.append(root);

  const rect = panel.getBoundingClientRect();
  const left = Math.max(8, Math.min(point.x, window.innerWidth - rect.width - 8));
  const top = Math.max(8, Math.min(point.y, window.innerHeight - rect.height - 8));
  panel.setCssStyles({ left: `${left}px` });
  panel.setCssStyles({ top: `${top}px` });

  let closed = false;
  const close = (restore: boolean): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('resize', onResize);
    root.remove();
    if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  };
  const onOutside = (event: PointerEvent): void => {
    if (event.target instanceof Node && root.contains(event.target)) return;
    close(false);
  };
  const onWindowBlur = (): void => close(false);
  const onResize = (): void => close(false);
  const onKeyDown = (event: KeyboardEvent): void => {
    const currentPanel = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-menu-panel]') : null;
    const activePanel = currentPanel && root.contains(currentPanel) ? currentPanel : panel;
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('button[data-menu-item]') : null;
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
      const query = event.key.toLocaleLowerCase();
      const items = buttonItems(activePanel);
      const current = items.indexOf(target ?? document.activeElement as HTMLButtonElement);
      for (let offset = 1; offset <= items.length; offset += 1) {
        const candidate = items[(Math.max(current, -1) + offset) % items.length];
        const label = candidate?.querySelector<HTMLElement>('.statblock-forge__table-menu-label')?.textContent?.trim().toLocaleLowerCase() ?? '';
        if (candidate && label.startsWith(query)) {
          candidate.focus();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }
    switch (event.key) {
      case 'Escape': {
        if (currentPanel && currentPanel !== panel) {
          const wrap = currentPanel.parentElement;
          const trigger = wrap?.querySelector<HTMLButtonElement>(':scope > button');
          currentPanel.hidden = true;
          trigger?.setAttribute('aria-expanded', 'false');
          trigger?.focus();
        } else close(true);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End': {
        const items = buttonItems(activePanel);
        if (items.length === 0) return;
        const current = items.indexOf(target ?? document.activeElement as HTMLButtonElement);
        const nextIndex = event.key === 'Home' ? 0
          : event.key === 'End' ? items.length - 1
            : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length
              : (current <= 0 ? items.length - 1 : current - 1);
        items[nextIndex]?.focus();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      case 'ArrowRight': {
        if (target?.getAttribute('aria-haspopup') !== 'menu') return;
        const wrap = target.parentElement;
        const child = wrap?.querySelector<HTMLElement>(':scope > .statblock-forge__table-menu-panel');
        if (wrap && child) {
          setSubmenuOpen(target, wrap, true);
          buttonItems(child)[0]?.focus();
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      case 'ArrowLeft': {
        if (!currentPanel || currentPanel === panel) return;
        const wrap = currentPanel.parentElement;
        const trigger = wrap?.querySelector<HTMLButtonElement>(':scope > button');
        currentPanel.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('resize', onResize);
  buttonItems(panel)[0]?.focus({ preventScroll: true });
  return () => close(false);
}
