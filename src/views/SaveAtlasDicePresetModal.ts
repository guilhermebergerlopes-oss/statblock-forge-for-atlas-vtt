import { Modal, Notice, type App } from 'obsidian';
import type { ForgeLanguage } from '../i18n/localization.ts';
import { saveAtlasDicePreset, type AtlasSavedRollCollection } from '../atlas/atlasSavedRolls.ts';
import { createAtlasDicePresetLookCandidate } from '../atlas/atlasDicePresetLook.ts';
import type { ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Names a statblock roll and saves it as an Atlas collection preset. */
export class SaveAtlasDicePresetModal extends Modal {
  constructor(
    app: App,
    private readonly language: ForgeLanguage,
    private readonly collection: AtlasSavedRollCollection,
    private readonly formula: string,
    private readonly suggestedName: string,
    private readonly activeDiceSet?: ForgeRestDiceSet | null,
  ) {
    super(app);
  }

  onOpen(): void {
    const pt = this.language !== 'en';
    const label = (english: string, portuguese: string): string => pt ? portuguese : english;
    const { contentEl } = this;
    contentEl.replaceChildren();
    this.modalEl.classList.add('statblock-forge__save-modal', 'statblock-forge__atlas-dice-preset-modal');
    contentEl.classList.add('statblock-forge__atlas-dice-preset-modal');
    this.setTitle(label('Save roll to Atlas', 'Salvar rolagem no Atlas'));

    const collection = element('p', 'statblock-forge__save-hint', label(
      `Collection: ${this.collection.collectionName}`,
      `Coleção: ${this.collection.collectionName}`,
    ));
    const formulaLabel = element('div', 'statblock-forge__save-label', label('Roll formula', 'Fórmula da rolagem'));
    const formulaText = element('code', 'statblock-forge__atlas-dice-preset-formula', this.formula);
    const lookCandidate = createAtlasDicePresetLookCandidate(this.formula, this.activeDiceSet);
    let useOwnLook = lookCandidate !== null;
    if (lookCandidate) {
      formulaLabel.textContent = label('Stored numeric bonus', 'Bônus numérico salvo');
      formulaText.textContent = lookCandidate.formula || label('No numeric bonus', 'Sem bônus numérico');
    }
    const nameField = element('label', 'statblock-forge__save-field');
    nameField.append(element('span', 'statblock-forge__save-label', label('Roll name', 'Nome da rolagem')));
    const input = element('input', 'statblock-forge__input statblock-forge__save-name');
    input.type = 'text';
    input.value = this.suggestedName.slice(0, 40);
    input.maxLength = 40;
    input.spellcheck = false;
    input.autocomplete = 'off';
    nameField.append(input);

    let lookOption: HTMLLabelElement | null = null;
    let lookCheckbox: HTMLInputElement | null = null;
    let lookHint: HTMLParagraphElement | null = null;
    if (lookCandidate) {
      lookOption = element('label', 'statblock-forge__save-field statblock-forge__atlas-dice-look-option');
      lookCheckbox = element('input', 'statblock-forge__atlas-dice-look-checkbox');
      lookCheckbox.type = 'checkbox';
      lookCheckbox.checked = true;
      const lookLabel = element('span', 'statblock-forge__save-label', label(
        lookCandidate.source === 'active-dice-set'
          ? `Use “${lookCandidate.setName}” as this roll's own dice look and rules`
          : 'Create an individual dice look from this formula',
        lookCandidate.source === 'active-dice-set'
          ? `Usar “${lookCandidate.setName}” como aparência e regras próprias desta rolagem`
          : 'Criar uma aparência de dados própria a partir desta fórmula',
      ));
      lookOption.append(lookCheckbox, lookLabel);
      lookHint = element('p', 'statblock-forge__save-hint', label(
        lookCandidate.source === 'active-dice-set'
          ? 'The saved roll gets its own copy of the dice, colours, critical, exploding, advantage and disadvantage rules. You can customize it later in Atlas Dice Lab.'
          : 'The written dice become an individual look with natural criticals. You can customize names, colours and rules later in Atlas Dice Lab.',
        lookCandidate.source === 'active-dice-set'
          ? 'A rolagem salva receberá uma cópia própria dos dados, cores, regras de crítico, explosão, vantagem e desvantagem. Você poderá personalizá-la depois no Dice Lab do Atlas.'
          : 'Os dados escritos serão convertidos em uma aparência própria com crítico natural. Você poderá personalizar nomes, cores e regras depois no Dice Lab do Atlas.',
      ));
      lookCheckbox.addEventListener('change', () => {
        useOwnLook = lookCheckbox?.checked === true;
        formulaLabel.textContent = useOwnLook
          ? label('Stored numeric bonus', 'Bônus numérico salvo')
          : label('Roll formula', 'Fórmula da rolagem');
        formulaText.textContent = useOwnLook
          ? (lookCandidate.formula || label('No numeric bonus', 'Sem bônus numérico'))
          : this.formula;
        if (lookHint) lookHint.hidden = !useOwnLook;
      });
    }

    const problem = element('p', 'statblock-forge__save-problem');
    problem.hidden = true;
    const actions = element('div', 'modal-button-container');
    const cancel = element('button', '', label('Cancel', 'Cancelar'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const save = element('button', 'mod-cta', label('Save roll', 'Salvar rolagem'));
    save.type = 'button';
    actions.append(cancel, save);
    contentEl.append(collection, formulaLabel, formulaText, nameField);
    if (lookOption && lookHint) contentEl.append(lookOption, lookHint);
    contentEl.append(problem, actions);

    let busy = false;
    const refresh = (message: string | null = null): void => {
      const missing = input.value.trim().length === 0;
      save.disabled = busy || missing;
      cancel.disabled = busy;
      input.disabled = busy;
      if (lookCheckbox) lookCheckbox.disabled = busy;
      problem.hidden = !message;
      problem.textContent = message ?? '';
    };
    const submit = async (): Promise<void> => {
      const name = input.value.trim();
      if (!name) {
        refresh(label('Enter a name for this roll.', 'Digite um nome para esta rolagem.'));
        input.focus();
        return;
      }
      busy = true;
      refresh();
      let result: Awaited<ReturnType<typeof saveAtlasDicePreset>>;
      try {
        result = await saveAtlasDicePreset(
          this.collection,
          name,
          useOwnLook && lookCandidate ? lookCandidate.formula : this.formula,
          undefined,
          useOwnLook && lookCandidate ? lookCandidate.look : undefined,
        );
      } catch {
        result = { ok: false, reason: 'collection-unavailable' };
      }
      if (result.ok) {
        new Notice(label(
          `Saved “${result.preset.name}” to ${this.collection.collectionName}.`,
          `“${result.preset.name}” foi salva em ${this.collection.collectionName}.`,
        ));
        this.close();
        return;
      }
      const message = result.reason === 'invalid-name'
        ? label('The name must contain 1–40 characters.', 'O nome deve ter entre 1 e 40 caracteres.')
        : result.reason === 'invalid-formula'
          ? label('This formula is not supported by Atlas or exceeds its 100-character limit.', 'Esta fórmula não é compatível com o Atlas ou excede o limite de 100 caracteres.')
          : result.reason === 'limit-reached'
            ? label('This collection already has 40 saved rolls.', 'Esta coleção já possui 40 rolagens salvas.')
            : label('Atlas could not save this roll. Check that the collection is still available.', 'O Atlas não conseguiu salvar esta rolagem. Verifique se a coleção ainda está disponível.');
      busy = false;
      refresh(message);
      input.focus();
    };

    input.addEventListener('input', () => refresh());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        void submit();
      }
    });
    save.addEventListener('click', () => { void submit(); });
    window.setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
