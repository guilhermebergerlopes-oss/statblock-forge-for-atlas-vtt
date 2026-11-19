export interface StatblockCardAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  run: () => unknown;
}

export interface StatblockCardActionsMenuOptions {
  label: string;
  actions: () => readonly StatblockCardAction[];
}

function iconFor(name: string | undefined): string {
  switch (name) {
    case 'refresh': return '↻';
    case 'edit': return '✎';
    case 'publish': return '↗';
    default: return '•';
  }
}

/**
 * The card-level actions menu used by Atlas' StatblockCardMenu, adapted to the
 * Forge DOM renderer. It deliberately lives below the card, while its popup is
 * portalled to body so an Obsidian pane cannot clip it.
 */
export function renderStatblockCardActionsMenu(options: StatblockCardActionsMenuOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = 'statblock-forge__card-actions-row';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'statblock-forge__card-actions-trigger';
  trigger.setAttribute('aria-label', options.label);
  trigger.setAttribute('title', options.label);
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.dataset.atlasChrome = 'true';
  const dots = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  dots.setAttribute('viewBox', '0 0 24 24');
  dots.setAttribute('width', '18');
  dots.setAttribute('height', '18');
  dots.setAttribute('fill', 'currentColor');
  dots.setAttribute('aria-hidden', 'true');
  for (const y of [5, 12, 19]) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '1.7');
    dots.append(circle);
  }
  trigger.append(dots);
  row.append(trigger);

  let portal: HTMLElement | null = null;
  let panel: HTMLElement | null = null;
  let removalObserver: MutationObserver | null = null;
  let closed = true;

  const close = (restoreFocus: boolean): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    removalObserver?.disconnect();
    removalObserver = null;
    portal?.remove();
    portal = null;
    panel = null;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  };

  const onOutside = (event: PointerEvent): void => {
    if (event.target instanceof Node && (portal?.contains(event.target) || trigger.contains(event.target))) return;
    close(false);
  };
  const onBlur = (): void => close(false);
  const onResize = (): void => close(false);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!panel || !(event.target instanceof Element) || !panel.contains(event.target)) return;
    const items = Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-menu-item]:not(:disabled)'));
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') {
      // Put focus back in the card's DOM order before the browser performs its
      // normal Tab/Shift+Tab traversal; the menu itself is portalled to body.
      close(true);
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (next >= 0) {
      event.preventDefault();
      event.stopPropagation();
      items[next]?.focus();
    }
  };

  const open = (): void => {
    if (!closed) {
      close(false);
      return;
    }
    closed = false;
    trigger.setAttribute('aria-expanded', 'true');
    const root = document.createElement('div');
    root.className = 'statblock-forge__table-menu-root statblock-forge__card-actions-portal';
    root.setAttribute('role', 'presentation');
    const menu = document.createElement('div');
    menu.className = 'statblock-forge__table-menu-panel statblock-forge__card-actions-panel';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', options.label);

    for (const action of options.actions()) {
      const wrap = document.createElement('div');
      wrap.className = 'statblock-forge__table-menu-item-wrap';
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'statblock-forge__table-menu-item';
      item.dataset.menuItem = 'true';
      item.dataset.actionId = action.id;
      item.setAttribute('role', 'menuitem');
      item.disabled = Boolean(action.disabled);
      const leading = document.createElement('span');
      leading.className = 'statblock-forge__table-menu-leading';
      const icon = document.createElement('span');
      icon.className = 'statblock-forge__table-menu-icon';
      icon.textContent = iconFor(action.icon);
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'statblock-forge__table-menu-label';
      label.textContent = action.label;
      leading.append(icon, label);
      item.append(leading);
      item.addEventListener('click', () => {
        if (item.disabled) return;
        close(false);
        try {
          void Promise.resolve(action.run()).catch((error: unknown) => {
            console.error(`Statblock Forge card action "${action.id}" failed.`, error);
          });
        } catch (error) {
          console.error(`Statblock Forge card action "${action.id}" failed.`, error);
        }
      });
      wrap.append(item);
      menu.append(wrap);
    }

    root.append(menu);
    document.body.append(root);
    portal = root;
    panel = menu;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = menu.getBoundingClientRect();
    const width = panelRect.width || 220;
    const height = panelRect.height || 120;
    const left = Math.max(8, Math.min(triggerRect.right - width, window.innerWidth - width - 8));
    const below = triggerRect.bottom + 4;
    const top = below + height <= window.innerHeight - 8
      ? below
      : Math.max(8, triggerRect.top - height - 4);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    removalObserver = new MutationObserver(() => {
      if (!row.isConnected) close(false);
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
    menu.querySelector<HTMLButtonElement>('button[data-menu-item]:not(:disabled)')?.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', open);
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  });
  return row;
}
