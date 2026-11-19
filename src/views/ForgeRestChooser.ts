import type { RecoveryButton, RecoveryChoice } from '../templates/recoveryEditorModel.ts';
import type { ForgeTemplate, JsonRecord } from '../templates/forgeTemplate.ts';
import type { AtlasRestResourceSnapshot } from '../atlas/atlasRestResources.ts';
import { restCounterSpendOptions } from '../statblocks/restRecoveryModel.ts';
import {
  isRestChoiceDraftValid,
  restChoiceActionCount,
  restChoicePicks,
  setRestChoiceActionCount,
  type RestChoiceDraft,
  type RestChoiceOrderEntry,
  type RestChoicePick,
} from '../statblocks/restChoiceSelectionModel.ts';
import type { ForgeLanguage } from '../i18n/localization.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Atlas-like anchored Rest chooser for action picks and Counter-backed Spend rules. */
export function openForgeRestChooser(
  anchor: HTMLButtonElement,
  rest: RecoveryButton,
  template: ForgeTemplate,
  data: JsonRecord,
  language: ForgeLanguage,
  onConfirm: (picks: readonly RestChoicePick[], spends: ReadonlyMap<string, number>) => void | Promise<void>,
  collectionResources: readonly AtlasRestResourceSnapshot[] = [],
): () => void {
  const portuguese = language === 'pt-BR';
  const label = (en: string, pt: string): string => portuguese ? pt : en;
  const draft: { value: RestChoiceDraft } = { value: {} };
  // Atlas keeps picks in the order the player selected them. The draft itself is keyed by IDs,
  // so retain the event order separately (including repeated picks of the same action).
  const selectionOrder: RestChoiceOrderEntry[] = [];
  const progressNodes = new Map<string, HTMLElement>();
  const spendValues = new Map<string, number>();
  const forOtherSelections = new Map<string, boolean>();
  const actionTargetKey = (choiceId: string, actionId: string): string => `${choiceId}\u0000${actionId}`;
  const getPicks = (): RestChoicePick[] => restChoicePicks(rest.choices ?? [], draft.value, selectionOrder).map((pick) => (
    forOtherSelections.get(actionTargetKey(pick.choice, pick.action)) === true
      ? { ...pick, forOther: true }
      : pick
  ));
  const controlsByChoice = new Map<string, Array<{
    input?: HTMLInputElement;
    minus?: HTMLButtonElement;
    count?: HTMLElement;
    plus?: HTMLButtonElement;
    forSelect?: HTMLSelectElement;
  }>>();
  const popover = element('div', 'statblock-forge__rest-popover');
  const panel = element('div', 'statblock-forge__rest-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', rest.name);
  panel.tabIndex = -1;

  const header = element('div', 'statblock-forge__rest-panel-header');
  header.append(element('h3', 'statblock-forge__rest-panel-title', rest.name));
  const closeButton = element('button', 'statblock-forge__rest-panel-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', label('Close rest choices', 'Fechar escolhas do descanso'));
  header.append(closeButton);

  const body = element('div', 'statblock-forge__rest-panel-body');
  const spendsSection = element('section', 'statblock-forge__rest-spends');
  const spendsHeading = element('h4', 'statblock-forge__rest-spends-heading', label('Spend', 'Gastar'));
  const spendsList = element('div', 'statblock-forge__rest-spends-list');
  spendsSection.append(spendsHeading, spendsList);

  const renderSpends = (): void => {
    const picks = getPicks();
    const options = restCounterSpendOptions({ template, data, button: rest, picks, collectionResources });
    const active = new Set(options.map((option) => option.ref));
    for (const ref of spendValues.keys()) if (!active.has(ref)) spendValues.delete(ref);
    spendsList.replaceChildren();
    spendsSection.hidden = options.length === 0;
    for (const option of options) {
      // Atlas' RestRequest includes an explicit zero for every offered Spend rule.
      if (!spendValues.has(option.ref)) spendValues.set(option.ref, 0);
      const row = element('div', 'statblock-forge__rest-spend-row');
      const text = element('div', 'statblock-forge__rest-spend-text');
      text.append(element('strong', '', option.label));
      text.append(element('small', '', label(`+${option.each} per unit`, `+${option.each} por unidade`)));
      const stepper = element('div', 'statblock-forge__rest-spend-stepper');
      const count = spendValues.get(option.ref) ?? 0;
      const minus = element('button', 'statblock-forge__rest-stepper-button', '−');
      minus.type = 'button';
      minus.disabled = count <= 0;
      minus.setAttribute('aria-label', label(`Spend one less ${option.label}`, `Gastar uma unidade a menos de ${option.label}`));
      const value = element('span', 'statblock-forge__rest-stepper-count', `${count} / ${option.max}`);
      value.setAttribute('aria-live', 'polite');
      const plus = element('button', 'statblock-forge__rest-stepper-button', '+');
      plus.type = 'button';
      plus.disabled = count >= option.max;
      plus.setAttribute('aria-label', label(`Spend one more ${option.label}`, `Gastar mais uma unidade de ${option.label}`));
      const update = (next: number): void => {
        spendValues.set(option.ref, Math.max(0, Math.min(option.max, Math.trunc(next))));
        renderSpends();
      };
      minus.addEventListener('click', () => update(count - 1));
      plus.addEventListener('click', () => update(count + 1));
      stepper.append(minus, value, plus);
      row.append(text, stepper);
      spendsList.append(row);
    }
  };

  const updateChoice = (choice: RecoveryChoice): void => {
    const total = choice.actions.reduce((sum, action) => sum + restChoiceActionCount(draft.value, choice.id, action.id), 0);
    const progress = progressNodes.get(choice.id);
    if (progress) {
      progress.textContent = `${total} / ${choice.max}${choice.min > 0 ? (portuguese ? ` · mín. ${choice.min}` : ` · min ${choice.min}`) : ''}`;
      progress.classList.toggle('is-complete', total >= choice.min && total <= choice.max);
    }
    const controls = controlsByChoice.get(choice.id) ?? [];
    choice.actions.forEach((action, index) => {
      const control = controls[index];
      if (!control) return;
      const count = restChoiceActionCount(draft.value, choice.id, action.id);
      if (control.input) {
        control.input.checked = count > 0;
        control.input.disabled = count === 0 && total >= choice.max;
      }
      if (control.count) control.count.textContent = String(count);
      if (control.minus) control.minus.disabled = count <= 0;
      if (control.plus) control.plus.disabled = total >= choice.max;
      if (control.forSelect) {
        control.forSelect.value = forOtherSelections.get(actionTargetKey(choice.id, action.id)) === true ? 'other' : 'self';
        control.forSelect.disabled = count === 0;
      }
    });
    confirmButton.disabled = !isRestChoiceDraftValid(rest.choices ?? [], draft.value);
    renderSpends();
  };

  const changeCount = (choice: RecoveryChoice, actionId: string, deltaOrValue: number): void => {
    const previousPicks = getPicks();
    const current = restChoiceActionCount(draft.value, choice.id, actionId);
    const next = choice.repeat === true ? current + deltaOrValue : deltaOrValue;
    draft.value = setRestChoiceActionCount(draft.value, choice, actionId, next);
    const updated = restChoiceActionCount(draft.value, choice.id, actionId);
    if (updated > current) {
      for (let index = 0; index < updated - current; index += 1) selectionOrder.push({ choice: choice.id, action: actionId });
    } else if (updated < current) {
      let remaining = current - updated;
      for (let index = selectionOrder.length - 1; index >= 0 && remaining > 0; index -= 1) {
        const entry = selectionOrder[index]!;
        if (entry.choice === choice.id && entry.action === actionId) {
          selectionOrder.splice(index, 1);
          remaining -= 1;
        }
      }
    }
    if (updated === 0) {
      forOtherSelections.delete(actionTargetKey(choice.id, actionId));
    }

    // Spend references contain the pick index. When a pick is removed, move values belonging
    // to later picks to their new indices instead of silently resetting their spend amounts.
    const nextPicks = getPicks();
    const identity = (pick: RestChoicePick): string => `${pick.choice}\u0000${pick.action}\u0000${pick.forOther === true ? 'other' : 'self'}`;
    const claimed = new Set<number>();
    const remapped = new Map<string, number>();
    for (const [ref, value] of spendValues) {
      if (ref.startsWith('always:')) remapped.set(ref, value);
    }
    previousPicks.forEach((pick, previousIndex) => {
      const nextIndex = nextPicks.findIndex((candidate, index) => !claimed.has(index) && identity(candidate) === identity(pick));
      if (nextIndex < 0) return;
      claimed.add(nextIndex);
      const prefix = `pick:${previousIndex}:`;
      for (const [ref, value] of spendValues) {
        if (ref.startsWith(prefix)) remapped.set(`pick:${nextIndex}:${ref.slice(prefix.length)}`, value);
      }
    });
    spendValues.clear();
    for (const [ref, value] of remapped) spendValues.set(ref, value);
    updateChoice(choice);
  };

  for (const [stepIndex, choice] of (rest.choices ?? []).entries()) {
    const section = element('section', 'statblock-forge__rest-choice-step');
    const heading = element('div', 'statblock-forge__rest-choice-step-head');
    heading.append(
      element('h4', '', `${stepIndex + 1}. ${choice.prompt}`),
      element('span', 'statblock-forge__rest-choice-progress', `0 / ${choice.max}${choice.min > 0 ? (portuguese ? ` · mín. ${choice.min}` : ` · min ${choice.min}`) : ''}`),
    );
    const progress = heading.querySelector<HTMLElement>('.statblock-forge__rest-choice-progress');
    if (progress) progressNodes.set(choice.id, progress);
    section.append(heading);

    const actions = element('div', 'statblock-forge__rest-choice-actions');
    for (const action of choice.actions) {
      const row = element('div', 'statblock-forge__rest-choice-action');
      const text = element('div', 'statblock-forge__rest-choice-action-text');
      text.append(element('strong', '', action.name));
      if (action.text?.trim()) text.append(element('span', '', action.text));
      let forSelect: HTMLSelectElement | undefined;
      if (action.forOthers === true) {
        const forLabel = element('label', 'statblock-forge__rest-choice-for-label');
        forLabel.append(element('span', '', label('For', 'Para')));
        forSelect = element('select', 'statblock-forge__rest-choice-for-select');
        const selfOption = element('option', '', label('This character', 'Este personagem'));
        selfOption.value = 'self';
        const otherOption = element('option', '', label('Another character', 'Outro personagem'));
        otherOption.value = 'other';
        forSelect.append(selfOption, otherOption);
        forSelect.value = 'self';
        forSelect.disabled = true;
        forSelect.addEventListener('change', () => {
          const key = actionTargetKey(choice.id, action.id);
          if (forSelect?.value === 'other') forOtherSelections.set(key, true);
          else forOtherSelections.delete(key);
          renderSpends();
        });
        forLabel.append(forSelect);
        text.append(forLabel);
      }
      const control = element('div', 'statblock-forge__rest-choice-action-control');
      if (choice.repeat === true) {
        const minus = element('button', 'statblock-forge__rest-stepper-button', '−');
        minus.type = 'button';
        minus.disabled = true;
        minus.setAttribute('aria-label', label(`Pick ${action.name} fewer times`, `Escolher ${action.name} menos vezes`));
        const count = element('span', 'statblock-forge__rest-stepper-count', '0');
        const plus = element('button', 'statblock-forge__rest-stepper-button', '+');
        plus.type = 'button';
        plus.setAttribute('aria-label', label(`Pick ${action.name} more times`, `Escolher ${action.name} mais vezes`));
        plus.addEventListener('click', () => changeCount(choice, action.id, 1));
        minus.addEventListener('click', () => changeCount(choice, action.id, -1));
        control.append(minus, count, plus);
        const rows = controlsByChoice.get(choice.id) ?? [];
        rows.push({ minus, count, plus, forSelect });
        controlsByChoice.set(choice.id, rows);
      } else {
        const checkboxLabel = element('label', 'statblock-forge__rest-choice-checkbox');
        const input = element('input');
        input.type = 'checkbox';
        input.addEventListener('change', () => changeCount(choice, action.id, input.checked ? 1 : 0));
        checkboxLabel.append(input, element('span', '', label('Choose', 'Escolher')));
        control.append(checkboxLabel);
        const rows = controlsByChoice.get(choice.id) ?? [];
        rows.push({ input, forSelect });
        controlsByChoice.set(choice.id, rows);
      }
      row.append(text, control);
      actions.append(row);
    }
    section.append(actions);
    body.append(section);
  }

  body.append(spendsSection);
  renderSpends();

  const footer = element('div', 'statblock-forge__rest-panel-footer');
  const cancelButton = element('button', 'statblock-forge__rest-panel-cancel', label('Cancel', 'Cancelar'));
  cancelButton.type = 'button';
  const confirmButton = element('button', 'statblock-forge__rest-panel-confirm', label('Confirm', 'Confirmar'));
  confirmButton.type = 'button';
  confirmButton.disabled = !isRestChoiceDraftValid(rest.choices ?? [], draft.value);
  footer.append(cancelButton, confirmButton);
  panel.append(header, body, footer);
  popover.append(panel);
  document.body.append(popover);

  let closed = false;
  const place = (): void => {
    if (closed) return;
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const viewportMargin = 8;
    const anchorGap = 6;
    const width = Math.min(340, Math.max(180, viewportWidth - 16));
    popover.setCssStyles({ width: `${width}px` });
    // Measure the unconstrained panel first. An explicit panel height then gives the flex body
    // a finite scrollport even when the list is taller than the available viewport space.
    panel.setCssStyles({ height: 'auto' });
    panel.setCssStyles({ maxHeight: 'none' });
    const naturalHeight = panel.getBoundingClientRect().height;
    const below = Math.max(0, viewportHeight - rect.bottom - anchorGap - viewportMargin);
    const above = Math.max(0, rect.top - anchorGap - viewportMargin);
    const useAbove = below < Math.min(naturalHeight, 360) && above > below;
    const available = useAbove ? above : below;
    const viewportLimit = Math.max(96, viewportHeight - viewportMargin * 2);
    const maxPanelHeight = Math.max(96, Math.min(640, viewportLimit, available || viewportLimit));
    panel.setCssStyles({ maxHeight: `${maxPanelHeight}px` });
    panel.setCssStyles({ height: `${Math.min(naturalHeight, maxPanelHeight)}px` });
    const panelHeight = panel.getBoundingClientRect().height;
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
    const top = useAbove
      ? rect.top - panelHeight - anchorGap
      : rect.bottom + anchorGap;
    popover.setCssStyles({ left: `${left}px` });
    popover.setCssStyles({ top: `${Math.max(viewportMargin, Math.min(viewportHeight - panelHeight - viewportMargin, top))}px` });
    popover.dataset.above = useAbove ? 'true' : 'false';
  };

  const close = (refocus: boolean): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', place);
    popover.remove();
    anchor.setAttribute('aria-expanded', 'false');
    anchor.dataset.state = 'closed';
    if (refocus) anchor.focus({ preventScroll: true });
  };
  const onOutside = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && !popover.contains(target) && target !== anchor) close(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  };
  const onScroll = (event: Event): void => {
    // The popover has its own scrollport. Scrolling inside it must not continuously reposition
    // the panel against its anchor; only scrolls outside the popover move the anchor itself.
    const target = event.target;
    if (target instanceof Node && popover.contains(target)) return;
    place();
  };

  cancelButton.addEventListener('click', () => close(true));
  closeButton.addEventListener('click', () => close(true));
  confirmButton.addEventListener('click', async () => {
    if (!isRestChoiceDraftValid(rest.choices ?? [], draft.value) || confirmButton.disabled) return;
    const picks = getPicks();
    confirmButton.disabled = true;
    confirmButton.textContent = label('Applying…', 'Aplicando…');
    try {
      await onConfirm(picks, new Map(spendValues));
      close(true);
    } catch {
      confirmButton.disabled = false;
      confirmButton.textContent = label('Confirm', 'Confirmar');
    }
  });
  anchor.setAttribute('aria-expanded', 'true');
  anchor.dataset.state = 'open';
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', place);
  place();
  panel.focus({ preventScroll: true });
  return () => close(false);
}
