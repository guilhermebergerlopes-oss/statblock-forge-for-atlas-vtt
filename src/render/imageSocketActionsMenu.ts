export interface ImageSocketMenuAction {
  id: string;
  label: string;
  icon?: 'image' | 'clear' | 'token' | 'link' | 'help';
  disabled?: boolean;
  title?: string;
  destructive?: boolean;
  /** Mark an exclusive menu choice, as used by the Counter Rest assignment picker. */
  checked?: boolean;
  /** Draw a separator before this action. */
  separatorBefore?: boolean;
  run: () => unknown;
}

export interface ImageSocketMenuOptions {
  label: string;
  actions: readonly ImageSocketMenuAction[];
  hint?: string;
  onClose?: () => void;
}

function iconFor(icon: ImageSocketMenuAction['icon']): string {
  switch (icon) {
    case 'image': return '▧';
    case 'clear': return '×';
    case 'token': return '◉';
    case 'link': return '↗';
    case 'help': return '?';
    default: return '•';
  }
}

/**
 * Opens a Forge-owned action panel beside its trigger, outside Obsidian's
 * transformed/clipped pane surfaces. It is shared by Image sockets and the
 * Counter Rest selector, without depending on Atlas React components.
 */
export function openImageSocketActionsMenu(
  anchor: HTMLButtonElement,
  options: ImageSocketMenuOptions,
): (restoreFocus?: boolean) => void {
  const root = document.createElement('div');
  root.className = 'statblock-forge__table-menu-root statblock-forge__image-socket-menu-root';
  root.setAttribute('role', 'presentation');

  const panel = document.createElement('div');
  panel.className = 'statblock-forge__table-menu-panel statblock-forge__image-socket-menu-panel';
  panel.setAttribute('role', 'menu');
  panel.setAttribute('aria-label', options.label);

  for (const action of options.actions) {
    if (action.separatorBefore) {
      const separator = document.createElement('div');
      separator.className = 'statblock-forge__table-menu-separator';
      separator.setAttribute('role', 'separator');
      panel.append(separator);
    }
    const wrap = document.createElement('div');
    wrap.className = 'statblock-forge__table-menu-item-wrap';
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `statblock-forge__table-menu-item${action.destructive ? ' is-destructive' : ''}`;
    item.dataset.menuItem = 'true';
    item.dataset.actionId = action.id;
    item.setAttribute('role', action.checked === undefined ? 'menuitem' : 'menuitemradio');
    if (action.checked !== undefined) item.setAttribute('aria-checked', String(action.checked));
    if (action.checked) item.classList.add('is-checked');
    item.disabled = Boolean(action.disabled);
    if (action.title) item.title = action.title;

    const leading = document.createElement('span');
    leading.className = 'statblock-forge__table-menu-leading';
    const icon = document.createElement('span');
    icon.className = 'statblock-forge__table-menu-icon statblock-forge__image-socket-menu-icon';
    icon.textContent = iconFor(action.icon);
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'statblock-forge__table-menu-label';
    label.textContent = action.label;
    leading.append(icon, label);
    item.append(leading);
    if (action.checked !== undefined) {
      const trailing = document.createElement('span');
      trailing.className = 'statblock-forge__table-menu-trailing';
      trailing.textContent = action.checked ? '✓' : '';
      trailing.setAttribute('aria-hidden', 'true');
      item.append(trailing);
    }

    item.addEventListener('click', () => {
      if (item.disabled) return;
      close(true);
      try {
        void Promise.resolve(action.run()).catch((error: unknown) => {
          console.error(`Statblock Forge Image action "${action.id}" failed.`, error);
        });
      } catch (error) {
        console.error(`Statblock Forge Image action "${action.id}" failed.`, error);
      }
    });
    wrap.append(item);
    panel.append(wrap);
  }

  if (options.hint) {
    const hint = document.createElement('p');
    hint.className = 'statblock-forge__image-socket-menu-hint';
    hint.textContent = options.hint;
    panel.append(hint);
  }

  root.append(panel);
  document.body.append(root);
  anchor.setAttribute('aria-expanded', 'true');
  anchor.setAttribute('aria-haspopup', 'menu');

  let closed = false;
  let removalObserver: MutationObserver | null = null;

  const close = (restoreFocus = false): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    removalObserver?.disconnect();
    removalObserver = null;
    root.remove();
    anchor.setAttribute('aria-expanded', 'false');
    if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
    options.onClose?.();
  };

  const onOutside = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && (root.contains(target) || anchor.contains(target))) return;
    close(false);
  };
  const onBlur = (): void => close(false);
  const onResize = (): void => close(false);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.target instanceof Element) || !panel.contains(event.target)) return;
    const items = Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-menu-item]:not(:disabled)'));
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      close(true);
      return;
    }
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next >= 0) {
      event.preventDefault();
      event.stopPropagation();
      items[next]?.focus({ preventScroll: true });
    }
  };

  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const panelRect = panel.getBoundingClientRect();
  const width = panelRect.width || 248;
  const height = panelRect.height || 160;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
  const below = rect.bottom + 6;
  const top = below + height <= viewportHeight - 8
    ? below
    : Math.max(8, rect.top - height - 6);
  panel.setCssStyles({ left: `${left}px` });
  panel.setCssStyles({ top: `${top}px` });

  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  removalObserver = new MutationObserver(() => {
    if (!anchor.isConnected) close(false);
  });
  removalObserver.observe(document.body, { childList: true, subtree: true });
  panel.querySelector<HTMLButtonElement>('button[data-menu-item]:not(:disabled)')?.focus({ preventScroll: true });

  return close;
}
