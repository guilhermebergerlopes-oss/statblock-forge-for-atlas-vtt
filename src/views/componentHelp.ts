export type ComponentHelpGroup = 'fields' | 'fieldTypes' | 'blocks' | 'containers';
export type ExampleKind = 'stat' | 'metric' | 'title' | 'heading' | 'divider' | 'vertical-divider' | 'text' | 'line' | 'tags' | 'scores' | 'entries' | 'pairs' | 'image' | 'spells' | 'dice' | 'choice' | 'counters' | 'checkboxes' | 'track' | 'section' | 'row' | 'tabs';

export interface ComponentHelpExampleSpec {
  kind: ExampleKind;
  variant?: number;
}

export interface ComponentHelpEntry {
  label: string;
  description: { en: string; 'pt-BR': string };
  example: ExampleKind;
}

export const COMPONENT_HELP: Record<ComponentHelpGroup, Record<string, ComponentHelpEntry>> = {
  fields: {
    value: { label: 'Value', description: { en: 'Creates a single-value Field. Choose Text, Number, Rating, Dice or Choice in Properties; dragging it to the Canvas creates a Stat block.', 'pt-BR': 'Cria um Field de valor único. Escolha Text, Number, Rating, Dice ou Choice em Properties; ao arrastá-lo para o Canvas, um bloco Stat é criado.' }, example: 'stat' },
    metric: { label: 'Metric', description: { en: 'Creates numeric Fields that can be displayed together in a compact metric grid; it does not create a progress bar. Dragging it to the Canvas creates a Metric block.', 'pt-BR': 'Cria Fields numéricos que podem ser exibidos juntos em uma grade compacta de métricas; não cria uma barra de progresso. Ao arrastá-lo para o Canvas, um bloco Metric é criado.' }, example: 'metric' },
    collections: { label: 'Collections', description: { en: 'Groups structured Fields such as Entries, Lists, Pairs and Spells. Choose the specific data type in Properties; dragging a Field to the Canvas creates its matching block.', 'pt-BR': 'Agrupa Fields estruturados, como Entries, Lists, Pairs e Spells. Escolha o tipo específico de dado em Properties; ao arrastar o Field para o Canvas, o bloco correspondente é criado.' }, example: 'entries' },
    table: { label: 'Table', description: { en: 'Creates a Tabular Data Field with reusable rows, columns and cell values; dragging it to the Canvas creates a Table block.', 'pt-BR': 'Cria um Field de dados tabulares com linhas, colunas e valores reutilizáveis; ao arrastá-lo para o Canvas, um bloco Table é criado.' }, example: 'scores' },
    resources: { label: 'Resources', description: { en: 'Groups resource Fields such as Counters and Checkboxes. Choose the specific data type in Properties; dragging a Field to the Canvas creates its matching block.', 'pt-BR': 'Agrupa Fields de recursos, como Counters e Checkboxes. Escolha o tipo específico de dado em Properties; ao arrastar o Field para o Canvas, o bloco correspondente é criado.' }, example: 'counters' },
    text: { label: 'Text', description: { en: 'Creates a Markdown Field for descriptions, notes or other written content; dragging it to the Canvas creates a Text block.', 'pt-BR': 'Cria um Field Markdown para descrições, anotações e outros conteúdos escritos; ao arrastá-lo para o Canvas, um bloco Text é criado.' }, example: 'text' },
    image: { label: 'Image', description: { en: 'Creates an Image Field that stores a Vault image reference; dragging it to the Canvas creates an Image block.', 'pt-BR': 'Cria um Field Image que armazena a referência de uma imagem do Vault; ao arrastá-lo para o Canvas, um bloco Image é criado.' }, example: 'image' },
  },
  fieldTypes: {
    text: { label: 'Text', description: { en: 'Stores a short, plain-text value such as a name or a short label.', 'pt-BR': 'Armazena um valor de texto simples, como um nome ou rótulo curto.' }, example: 'text' },
    markdown: { label: 'Markdown', description: { en: 'Stores longer formatted text with paragraphs, links and Markdown styling.', 'pt-BR': 'Armazena textos mais longos e formatados, com parágrafos, links e Markdown.' }, example: 'text' },
    number: { label: 'Number', description: { en: 'Stores a numeric value that can be used in calculations, metrics or resource tracks.', 'pt-BR': 'Armazena um valor numérico que pode ser usado em cálculos, métricas ou trilhas de recursos.' }, example: 'stat' },
    rating: { label: 'Rating', description: { en: 'Stores a rating or level-like numeric value, often used for attributes or proficiency.', 'pt-BR': 'Armazena um valor numérico de grau ou nível, frequentemente usado para atributos ou proficiência.' }, example: 'stat' },
    dice: { label: 'Dice', description: { en: 'Stores a dice expression such as 1d20+5 or 2d6.', 'pt-BR': 'Armazena uma expressão de dados, como 1d20+5 ou 2d6.' }, example: 'dice' },
    choice: { label: 'Choice', description: { en: 'Stores one selected value from a predefined list of options.', 'pt-BR': 'Armazena um valor escolhido em uma lista de opções predefinidas.' }, example: 'choice' },
    list: { label: 'List', description: { en: 'Stores multiple values that can be displayed as a list or tags.', 'pt-BR': 'Armazena vários valores que podem ser exibidos como lista ou etiquetas.' }, example: 'tags' },
    scores: { label: 'Tabular Data', description: { en: 'Stores structured rows, columns and calculated values. A Table block can display this Field; the data remains stored here.', 'pt-BR': 'Armazena linhas, colunas e valores calculados. Um bloco Table pode exibir este Field; os dados continuam armazenados aqui.' }, example: 'scores' },
    entries: { label: 'Entries / Abilities', description: { en: 'Stores named entries with descriptions and optional Ability Parts.', 'pt-BR': 'Armazena entradas com nomes, descrições e Ability Parts opcionais.' }, example: 'entries' },
    pairs: { label: 'Pairs', description: { en: 'Stores related label-and-value pairs.', 'pt-BR': 'Armazena pares de informações relacionadas em rótulo e valor.' }, example: 'pairs' },
    image: { label: 'Image', description: { en: 'Stores a reference to an image in the Obsidian Vault.', 'pt-BR': 'Armazena uma referência a uma imagem no Vault do Obsidian.' }, example: 'image' },
    spells: { label: 'Spells', description: { en: 'Stores spellcasting groups, usage labels (such as At will or 1/day), and comma-separated spell names in Atlas format.', 'pt-BR': 'Armazena grupos de conjuração, indicações de uso (como À vontade ou 1/dia) e nomes de magias separados por vírgula, no formato do Atlas.' }, example: 'spells' },
    counters: { label: 'Counters', description: { en: 'Stores resource counters with current and maximum values.', 'pt-BR': 'Armazena contadores de recursos com valores atuais e máximos.' }, example: 'counters' },
    checkboxes: { label: 'Checkboxes', description: { en: 'Stores a keyed boolean for every configured option.', 'pt-BR': 'Armazena um valor booleano com key própria para cada opção configurada.' }, example: 'checkboxes' },
  },
  blocks: {
    heading: { label: 'Heading', description: { en: 'Adds a static heading, or choose an optional Text Field to display it as a formatted title. Both use the same insertion option.', 'pt-BR': 'Adiciona um título fixo ou permite escolher um Field Text opcional para exibi-lo como título formatado. As duas opções usam a mesma opção de inserção.' }, example: 'heading' },
    title: { label: 'Title', description: { en: 'Displays a Text Field as a formatted title, with a configurable heading level.', 'pt-BR': 'Exibe um Field Text como título formatado, com nível de cabeçalho configurável.' }, example: 'title' },
    collections: { label: 'Collections', description: { en: 'Displays a collection Field using its matching layout: Lists become Tags, while Entries, Pairs and Spells keep their specialized presentation. Choose the Field and Forge selects the correct renderer.', 'pt-BR': 'Exibe um Field de coleção no formato correspondente: Lists se tornam Tags, enquanto Entries, Pairs e Spells mantêm suas apresentações próprias. Escolha o Field e o Forge seleciona o bloco correto.' }, example: 'entries' },
    resources: { label: 'Resources', description: { en: 'Displays a resource Field using its matching layout: Counters or Checkboxes. Choose the Field and Forge selects the correct renderer.', 'pt-BR': 'Exibe um Field de recurso no formato correspondente: Counters ou Checkboxes. Escolha o Field e o Forge seleciona o bloco correto.' }, example: 'counters' },
    divider: { label: 'Divider', description: { en: 'Adds a thin separator. Choose horizontal or vertical orientation; vertical dividers are useful between blocks in a Row.', 'pt-BR': 'Adiciona um separador fino. Escolha a orientação horizontal ou vertical; divisores verticais são úteis entre blocos em uma Row.' }, example: 'divider' },
    'vertical-divider': { label: 'Vertical divider', description: { en: 'Adds a thin vertical visual separator, useful between blocks in a Row. This is Forge-only; Atlas supports horizontal dividers.', 'pt-BR': 'Adiciona uma linha vertical fina para separar blocos, especialmente dentro de uma Row. É um recurso exclusivo do Forge; o Atlas suporta apenas divisores horizontais.' }, example: 'vertical-divider' },
    text: { label: 'Text', description: { en: 'Displays written content in a text area, suitable for descriptions or notes.', 'pt-BR': 'Exibe conteúdo escrito em uma área de texto, ideal para descrições e anotações.' }, example: 'text' },
    line: { label: 'Line', description: { en: 'Places up to four compatible scalar Fields side by side in a compact line.', 'pt-BR': 'Exibe até quatro Fields escalares compatíveis lado a lado em uma linha compacta.' }, example: 'line' },
    stat: { label: 'Stat', description: { en: 'Displays one Field as a labeled value, such as HP, Armor or Level.', 'pt-BR': 'Exibe um Field como valor identificado, por exemplo PV, Armadura ou Nível.' }, example: 'stat' },
    metric: { label: 'Metric', description: { en: 'Displays numeric Fields together in a compact grid of labeled values.', 'pt-BR': 'Exibe Fields numéricos juntos em uma grade compacta de valores identificados.' }, example: 'metric' },
    tags: { label: 'Tags', description: { en: 'Displays a list of values as chips or a compact tag list.', 'pt-BR': 'Exibe uma lista de valores como etiquetas ou chips compactos.' }, example: 'tags' },
    scores: { label: 'Table', description: { en: 'Displays a Tabular Data Field as a visual table or compact list. This block controls presentation; it does not store a separate copy of the data.', 'pt-BR': 'Exibe um Field de dados tabulares como tabela visual ou lista compacta. Este bloco controla a apresentação; ele não armazena uma cópia separada dos dados.' }, example: 'scores' },
    entries: { label: 'Entries / Abilities', description: { en: 'Displays named entries with descriptions and optional Ability Parts.', 'pt-BR': 'Exibe entradas com nomes, descrições e Ability Parts opcionais.' }, example: 'entries' },
    pairs: { label: 'Pairs', description: { en: 'Displays related values as label-and-value pairs.', 'pt-BR': 'Exibe informações relacionadas em pares de rótulo e valor.' }, example: 'pairs' },
    image: { label: 'Image', description: { en: 'Displays an image referenced by an Image Field.', 'pt-BR': 'Exibe uma imagem referenciada por um Field Image.' }, example: 'image' },
    spells: { label: 'Spells', description: { en: 'Displays spellcasting groups as a line list or as tabs for each usage/level.', 'pt-BR': 'Exibe grupos de conjuração como lista em linhas ou abas separadas por uso/nível.' }, example: 'spells' },
    counters: { label: 'Counters', description: { en: 'Displays current and maximum uses with pips or other counter indicators.', 'pt-BR': 'Exibe usos atuais e máximos com pontos ou outros indicadores de contador.' }, example: 'counters' },
    checkboxes: { label: 'Checkboxes', description: { en: 'Displays named boolean options from a reusable Checkboxes Field.', 'pt-BR': 'Exibe opções booleanas nomeadas de um Field Checkboxes reutilizável.' }, example: 'checkboxes' },
    track: { label: 'Track', description: { en: 'Displays a progression track using boxes or a gauge.', 'pt-BR': 'Exibe uma trilha de progresso usando caixas ou uma barra.' }, example: 'track' },
  },
  containers: {
    section: { label: 'Section', description: { en: 'Groups related blocks in a section. It can have its own heading and nested layout.', 'pt-BR': 'Agrupa blocos relacionados em uma seção. Pode ter título próprio e layout interno.' }, example: 'section' },
    row: { label: 'Row', description: { en: 'Arranges child blocks horizontally, sharing the available width.', 'pt-BR': 'Organiza os blocos filhos horizontalmente, distribuindo a largura disponível.' }, example: 'row' },
    tabs: { label: 'Tabs container', description: { en: 'Creates a tab strip. Each child Section becomes an individual tab.', 'pt-BR': 'Cria uma faixa de abas. Cada Section filha se torna uma aba independente.' }, example: 'tabs' },
  },
};


const FIELD_CATEGORY_EXAMPLES: Record<string, ComponentHelpExampleSpec[]> = {
  value: [{ kind: 'stat', variant: 0 }, { kind: 'stat', variant: 1 }, { kind: 'stat', variant: 5 }],
  metric: [{ kind: 'metric', variant: 0 }, { kind: 'metric', variant: 1 }, { kind: 'metric', variant: 2 }],
  collections: [
    { kind: 'entries', variant: 0 }, { kind: 'tags', variant: 0 },
    { kind: 'pairs', variant: 0 }, { kind: 'spells', variant: 0 },
  ],
  table: [{ kind: 'scores', variant: 0 }, { kind: 'scores', variant: 1 }, { kind: 'scores', variant: 2 }],
  resources: [
    { kind: 'counters', variant: 0 }, { kind: 'counters', variant: 1 }, { kind: 'checkboxes', variant: 0 },
  ],
  text: [{ kind: 'text', variant: 0 }, { kind: 'text', variant: 1 }, { kind: 'text', variant: 2 }],
  image: [{ kind: 'image', variant: 0 }, { kind: 'image', variant: 1 }, { kind: 'image', variant: 2 }],
};

const BLOCK_EXAMPLES: Record<string, ComponentHelpExampleSpec[]> = {
  // These are deliberately combined in the picker because they are variants
  // of one concept; their native renderer types remain unchanged.
  heading: [{ kind: 'heading', variant: 0 }, { kind: 'title', variant: 0 }],
  divider: [{ kind: 'divider', variant: 0 }, { kind: 'vertical-divider', variant: 0 }],
  collections: [
    { kind: 'tags', variant: 0 }, { kind: 'entries', variant: 0 },
    { kind: 'pairs', variant: 0 }, { kind: 'spells', variant: 0 },
  ],
  resources: [{ kind: 'counters', variant: 0 }, { kind: 'checkboxes', variant: 0 }],
};

const FIELD_TYPE_EXAMPLES: Record<string, ComponentHelpExampleSpec[]> = {
  text: [{ kind: 'stat', variant: 2 }, { kind: 'stat', variant: 4 }, { kind: 'line', variant: 1 }],
  markdown: [{ kind: 'text', variant: 0 }, { kind: 'text', variant: 1 }, { kind: 'text', variant: 2 }],
  number: [{ kind: 'stat', variant: 0 }, { kind: 'stat', variant: 1 }, { kind: 'metric', variant: 0 }],
  rating: [{ kind: 'stat', variant: 3 }, { kind: 'stat', variant: 6 }, { kind: 'metric', variant: 2 }],
  dice: [{ kind: 'dice', variant: 0 }, { kind: 'dice', variant: 1 }, { kind: 'dice', variant: 2 }],
  choice: [{ kind: 'stat', variant: 7 }, { kind: 'stat', variant: 8 }, { kind: 'choice', variant: 0 }],
  list: [{ kind: 'tags', variant: 0 }, { kind: 'tags', variant: 1 }, { kind: 'tags', variant: 2 }],
  scores: [{ kind: 'scores', variant: 0 }, { kind: 'scores', variant: 1 }, { kind: 'scores', variant: 2 }],
  entries: [{ kind: 'entries', variant: 0 }, { kind: 'entries', variant: 1 }, { kind: 'entries', variant: 2 }],
  pairs: [{ kind: 'pairs', variant: 0 }, { kind: 'pairs', variant: 1 }, { kind: 'pairs', variant: 2 }],
  image: [{ kind: 'image', variant: 0 }, { kind: 'image', variant: 1 }, { kind: 'image', variant: 2 }],
  spells: [{ kind: 'spells', variant: 0 }, { kind: 'spells', variant: 1 }, { kind: 'spells', variant: 2 }],
  counters: [{ kind: 'counters', variant: 0 }, { kind: 'counters', variant: 1 }, { kind: 'counters', variant: 2 }],
  checkboxes: [{ kind: 'checkboxes', variant: 0 }, { kind: 'checkboxes', variant: 1 }, { kind: 'checkboxes', variant: 2 }],
};

export function componentHelpExamples(group: ComponentHelpGroup, key: string, fallback: ComponentHelpEntry): ComponentHelpExampleSpec[] {
  const configured = group === 'fields'
    ? FIELD_CATEGORY_EXAMPLES[key]
    : group === 'fieldTypes'
      ? FIELD_TYPE_EXAMPLES[key]
      : group === 'blocks'
        ? BLOCK_EXAMPLES[key]
        : undefined;
  return configured?.length ? configured : [{ kind: fallback.example }];
}

export function componentHelpEntry(group: ComponentHelpGroup, key: string): ComponentHelpEntry | undefined {
  return COMPONENT_HELP[group][key];
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}


/** A small child block shaped like the Stat blocks used inside real Sections and Rows. */
function appendStatBlock(parent: HTMLElement, label: string, value: string): HTMLElement {
  const block = make('article', 'statblock-forge__preview-block is-stat');
  const stat = make('div', 'statblock-forge__preview-stat is-run-in');
  stat.append(
    make('strong', 'statblock-forge__preview-stat-label', label),
    make('span', 'statblock-forge__preview-stat-value', value),
  );
  block.append(stat);
  parent.append(block);
  return block;
}

function appendSectionContents(
  parent: HTMLElement,
  values: Array<[string, string]>,
  inTab = false,
  heading = 'Attributes',
): void {
  const section = make('section', `statblock-forge__preview-section${inTab ? ' is-tab-panel' : ''}`);
  if (!inTab) section.append(make('h4', 'statblock-forge__preview-section-heading', heading));
  const grid = make('div', 'statblock-forge__preview-grid is-section');
  grid.setCssStyles({ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' });
  grid.setCssStyles({ gridAutoRows: '2rem' });
  const span = Math.floor(12 / Math.max(1, values.length));
  for (const [label, value] of values) {
    const child = appendStatBlock(grid, label, value);
    child.setCssStyles({ gridColumn: `span ${span}` });
  }
  section.append(grid);
  parent.append(section);
}

function appendDiceLink(parent: HTMLElement, formula: string): void {
  const link = make('span', 'statblock-forge__dice-link', formula);
  link.dataset.formula = formula.replace(/\s+/g, '');
  link.setAttribute('role', 'button');
  link.setAttribute('tabindex', '0');
  link.setAttribute('aria-label', `Rolar ${formula}`);
  parent.append(link);
}

function appendStatExample(parent: HTMLElement, label: string, value: string, dice = false): void {
  const stat = make('div', 'atlas-sb-labelled atlas-sb-labelled--run-in atlas-sb-stat statblock-forge__preview-stat is-run-in');
  stat.append(make('span', 'atlas-sb-label statblock-forge__preview-stat-label', label));
  const valueNode = make('span', 'atlas-sb-value statblock-forge__preview-stat-value');
  if (dice) appendDiceLink(valueNode, value);
  else valueNode.textContent = value;
  stat.append(valueNode);
  parent.append(stat);
}

function appendScoreTable(parent: HTMLElement, columns: string[], rows: string[][], lines = false): void {
  if (lines) {
    const linesRoot = make('div', 'statblock-forge__preview-score-lines');
    const table = make('table', 'statblock-forge__preview-score-lines-table');
    const body = make('tbody');
    rows[0]?.forEach((value, index) => {
      const row = make('tr');
      const heading = make('th', '', columns[index] ?? `Column ${index + 1}`);
      heading.scope = 'row';
      const cell = make('td');
      if (/^[+-]?\d*d\d+/i.test(value)) appendDiceLink(cell, value);
      else cell.textContent = value;
      row.append(heading, cell);
      body.append(row);
    });
    table.append(body);
    linesRoot.append(table);
    parent.append(linesRoot);
    return;
  }

  const table = make('table', 'statblock-forge__preview-score-table');
  const head = make('thead');
  const headRow = make('tr');
  columns.forEach((column) => headRow.append(make('th', '', column)));
  head.append(headRow);
  const body = make('tbody');
  rows.forEach((values) => {
    const row = make('tr');
    values.forEach((value) => {
      const cell = make('td');
      if (/^[+-]?\d*d\d+/i.test(value)) appendDiceLink(cell, value);
      else cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  parent.append(table);
}

function appendEntryExample(parent: HTMLElement, name: string, description: string, parts: Array<[string, string]>): void {
  const row = make('div', 'statblock-forge__preview-entry');
  const content = make('div', 'statblock-forge__preview-entry-content');
  content.append(make('strong', 'statblock-forge__preview-entry-name', name));
  content.append(make('span', 'statblock-forge__preview-entry-description', description));
  if (parts.length) {
    const extras = make('span', 'statblock-forge__preview-parts');
    parts.forEach(([label, value]) => {
      const part = make('span', 'statblock-forge__preview-entry-part');
      part.append(make('span', 'statblock-forge__preview-entry-part-label', `${label}:`));
      const partValue = make('span', 'statblock-forge__preview-entry-part-value');
      if (/\d*d\d+/i.test(value)) appendDiceLink(partValue, value);
      else partValue.textContent = value;
      part.append(partValue);
      extras.append(part);
    });
    content.append(extras);
  }
  row.append(content);
  parent.append(row);
}

function appendPairExample(parent: HTMLElement, label: string, pairs: Array<[string, string]>): void {
  const wrapper = make('div', 'atlas-sb-labelled atlas-sb-labelled--run-in atlas-sb-pairs statblock-forge__preview-pairs');
  wrapper.append(make('span', 'atlas-sb-label', label));
  const list = make('span', 'atlas-sb-value statblock-forge__preview-pair-list');
  pairs.forEach(([key, value]) => {
    const item = make('span', 'statblock-forge__preview-pair');
    item.append(make('strong', 'statblock-forge__preview-pair-key', key), document.createTextNode(': '));
    const valueNode = make('span', 'statblock-forge__preview-pair-value');
    if (/\d*d\d+/i.test(value)) appendDiceLink(valueNode, value);
    else valueNode.textContent = value;
    item.append(valueNode);
    list.append(item);
  });
  wrapper.append(list);
  parent.append(wrapper);
}

function appendSpellExample(parent: HTMLElement, header: string, lines: Array<[string, string]>, tabs = false): void {
  const group = make('section', 'statblock-forge__preview-spell-group');
  group.append(make('strong', 'statblock-forge__preview-spell-header', header));
  const appendList = (target: HTMLElement, entries: Array<[string, string]>): void => {
    const list = make('ul', 'statblock-forge__preview-spell-list');
    entries.forEach(([level, spell]) => {
      const item = make('li', 'statblock-forge__preview-spell-item');
      if (level) item.append(make('strong', 'statblock-forge__preview-spell-level', `${level}: `));
      const name = make('span', 'statblock-forge__preview-spell-name');
      const diceMatch = spell.match(/^(.*?)(\s*\([^)]*\d*d\d+[^)]*\))$/i);
      if (diceMatch) {
        name.append(document.createTextNode(diceMatch[1] ?? ''));
        appendDiceLink(name, (diceMatch[2] ?? '').replace(/[()\s]/g, ''));
      } else name.textContent = spell;
      item.append(name);
      list.append(item);
    });
    target.append(list);
  };
  if (!tabs) {
    appendList(group, lines);
  } else {
    const tabsRoot = make('div', 'statblock-forge__preview-spell-tabs');
    const strip = make('div', 'statblock-forge__preview-tab-strip');
    const panels = make('div', 'statblock-forge__preview-spell-panels');
    const levels = [...new Set(lines.map(([level]) => level))];
    levels.forEach((level, index) => {
      const tab = make('span', `statblock-forge__preview-tab${index === 0 ? ' is-active' : ''}`, level);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(index === 0));
      strip.append(tab);
      const panel = make('ul', 'statblock-forge__preview-spell-list');
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = index !== 0;
      lines.filter(([candidate]) => candidate === level).forEach(([, spell]) => {
        const item = make('li', 'statblock-forge__preview-spell-item');
        const name = make('span', 'statblock-forge__preview-spell-name');
        const diceMatch = spell.match(/^(.*?)(\s*\([^)]*\d*d\d+[^)]*\))$/i);
        if (diceMatch) {
          name.append(document.createTextNode(diceMatch[1] ?? ''));
          appendDiceLink(name, (diceMatch[2] ?? '').replace(/[()\s]/g, ''));
        } else name.textContent = spell;
        item.append(name);
        panel.append(item);
      });
      panels.append(panel);
    });
    tabsRoot.append(strip, panels);
    group.append(tabsRoot);
  }
  parent.append(group);
}

function appendCounterExample(parent: HTMLElement, name: string, max: number, used: number, numeric = false): void {
  const row = make('span', 'atlas-sb-counter statblock-forge__preview-counter-row');
  row.append(make('span', 'statblock-forge__preview-counter-name', name));
  const main = make('span', 'statblock-forge__preview-counter-main');
  if (numeric) {
    const stepper = make('span', 'atlas-sb-counter__stepper');
    stepper.append(make('span', 'atlas-sb-counter__step', '−'));
    stepper.append(make('span', 'atlas-sb-counter__count', `${max - used} / ${max}`));
    stepper.append(make('span', 'atlas-sb-counter__step', '+'));
    main.append(stepper);
  } else {
    const pips = make('span', 'atlas-sb-counter__pips statblock-forge__preview-counter-pips');
    pips.setAttribute('role', 'img');
    pips.setAttribute('aria-label', `${name}: ${max - used}/${max}`);
    for (let index = 0; index < max; index += 1) {
      const pip = make('span', `atlas-sb-counter__pip${index < max - used ? ' is-filled' : ''}`);
      pips.append(pip);
    }
    main.append(pips);
  }
  row.append(main);
  parent.append(row);
}

/** Builds a theme-aware sample with the same presentation classes used by the statblock renderer. */
export function renderComponentHelpExample(kind: ExampleKind, themeId: string, language: 'en' | 'pt-BR', variant = 0): HTMLElement {
  const pt = language === 'pt-BR';
  const root = make('div', 'statblock-forge__statblock statblock-forge__help-example');
  root.dataset.forgeTheme = themeId;
  root.dataset.exampleKind = kind;
  root.dataset.exampleVariant = String(variant);
  const block = make('div', `statblock-forge__preview-block is-${kind}`);
  block.dataset.appearanceMode = 'theme';

  switch (kind) {
    case 'stat': {
      const samples: Array<[string, string, boolean]> = pt
        ? [['Pontos de Vida', '42', false], ['Armadura', '16', false], ['Tipo', 'Aberração', false], ['Desafio', '1/4', false], ['Proficiência', '+3', false], ['Dano', '2d8+4', true], ['Deslocamento', '9 m', false], ['Tamanho', 'Grande', false], ['Tendência', 'Neutro', false]]
        : [['Hit Points', '42', false], ['Armor', '16', false], ['Type', 'Aberration', false], ['Challenge', '1/4', false], ['Proficiency', '+3', false], ['Damage', '2d8+4', true], ['Speed', '30 ft.', false], ['Size', 'Large', false], ['Alignment', 'Neutral', false]];
      const sample = samples[variant % samples.length] ?? samples[0]!;
      appendStatExample(block, sample[0], sample[1], sample[2]);
      if (variant === 7 || variant === 8) {
        const options = make('div', 'statblock-forge__help-option-note');
        options.textContent = pt
          ? (variant === 7 ? 'Opções: Pequeno · Médio · Grande' : 'Opções: Leal · Neutro · Caótico')
          : (variant === 7 ? 'Options: Small · Medium · Large' : 'Options: Lawful · Neutral · Chaotic');
        block.append(options);
      }
      break;
    }
    case 'metric': {
      const metric = make('div', 'statblock-forge__preview-metric');
      const rows = make('div', 'statblock-forge__preview-metric-rows');
      const samples: Array<Array<[string, string]>> = pt
        ? [[['PV', '42'], ['CA', '16'], ['Nível', '5']], [['FOR', '+4'], ['DES', '+2']], [['Força', '18'], ['Destreza', '14'], ['Sabedoria', '12'], ['Carisma', '10']]]
        : [[['HP', '42'], ['AC', '16'], ['Level', '5']], [['STR', '+4'], ['DEX', '+2']], [['Strength', '18'], ['Dexterity', '14'], ['Wisdom', '12'], ['Charisma', '10']]];
      const values = samples[variant % samples.length] ?? samples[0]!;
      const grid = make('div', 'statblock-forge__preview-metric-grid');
      grid.setCssStyles({ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` });
      values.forEach(([label, value]) => {
        const cell = make('div', 'statblock-forge__preview-metric-cell');
        cell.append(make('span', 'statblock-forge__preview-field-label', label), make('strong', 'statblock-forge__preview-metric-value', value));
        grid.append(cell);
      });
      rows.append(grid);
      metric.append(rows);
      block.append(metric);
      break;
    }
    case 'title': block.append(make('h2', 'statblock-forge__preview-title level-2', pt ? 'Nome da criatura' : 'Creature name')); break;
    case 'heading': block.append(make('strong', 'statblock-forge__preview-heading is-section', pt ? 'Atributos' : 'Attributes')); break;
    case 'divider': block.append(make('hr', 'statblock-forge__preview-divider')); break;
    case 'vertical-divider': {
      block.classList.add('is-vertical-divider');
      const separator = make('span', 'statblock-forge__preview-vertical-divider');
      separator.setAttribute('role', 'separator');
      separator.setAttribute('aria-orientation', 'vertical');
      block.append(separator);
      break;
    }
    case 'text': {
      const content = make('div', 'atlas-sb-prose statblock-forge__preview-text-content');
      if (variant % 3 === 0) {
        const paragraph = make('p');
        paragraph.append(document.createTextNode(pt ? 'Um guardião antigo protege as ruínas. ' : 'An ancient guardian protects the ruins. '));
        paragraph.append(make('strong', '', pt ? 'É hostil quando ameaçado.' : 'It becomes hostile when threatened.'));
        content.append(paragraph);
      } else if (variant % 3 === 1) {
        content.append(make('p', '', pt ? 'Criado para proteger o santuário, este ser raramente abandona seu posto.' : 'Created to protect the sanctuary, this creature rarely leaves its post.'));
        const note = make('p');
        note.append(make('em', '', pt ? 'Observação: evita atacar viajantes desarmados.' : 'Note: it avoids attacking unarmed travelers.'));
        content.append(note);
      } else {
        content.append(make('strong', '', pt ? 'Resistências' : 'Resistances'));
        const list = make('ul');
        list.append(make('li', '', pt ? 'Dano de fogo' : 'Fire damage'), make('li', '', pt ? 'Efeitos de medo' : 'Fear effects'));
        content.append(list);
      }
      block.append(content);
      break;
    }
    case 'line': {
      const values: Array<[string, string]> = pt
        ? (variant % 2 === 0 ? [['FOR', '+4'], ['DES', '+2'], ['CON', '+3']] : [['PV', '42'], ['CA', '16'], ['ND', '5']])
        : (variant % 2 === 0 ? [['STR', '+4'], ['DEX', '+2'], ['CON', '+3']] : [['HP', '42'], ['AC', '16'], ['CR', '5']]);
      const line = make('div', 'statblock-forge__preview-line');
      values.forEach(([label, value], index) => {
        if (index) line.append(document.createTextNode(' · '));
        line.append(make('strong', 'statblock-forge__preview-line-label', `${label} `), make('span', 'statblock-forge__preview-line-value', value));
      });
      block.append(line);
      break;
    }
    case 'tags': {
      const variants: Array<{ look: string; heading: string; values: string[] }> = pt
        ? [
            { look: 'chips', heading: 'Traços', values: ['Humanoide', 'Elite', 'Fogo'] },
            { look: 'numbered', heading: 'Idiomas', values: ['Comum', 'Élfico', 'Dracônico'] },
            { look: 'comma', heading: 'Imunidades', values: ['Veneno', 'Enfeitiçado', 'Amedrontado'] },
          ]
        : [
            { look: 'chips', heading: 'Traits', values: ['Humanoid', 'Elite', 'Fire'] },
            { look: 'numbered', heading: 'Languages', values: ['Common', 'Elvish', 'Draconic'] },
            { look: 'comma', heading: 'Immunities', values: ['Poison', 'Charmed', 'Frightened'] },
          ];
      const sample = variants[variant % variants.length]!;
      const tags = make('div', `statblock-forge__preview-tags is-${sample.look}`);
      tags.append(make('strong', 'statblock-forge__preview-block-heading', sample.heading));
      const value = make(sample.look === 'comma' ? 'span' : 'div', 'statblock-forge__preview-tags-value');
      if (sample.look === 'comma') {
        const inline = make('span', 'statblock-forge__preview-tags-inline');
        sample.values.forEach((entry, index) => {
          if (index) inline.append(document.createTextNode(', '));
          inline.append(make('span', 'statblock-forge__preview-tag-item', entry));
        });
        value.append(inline);
      } else {
        const list = make(sample.look === 'numbered' ? 'ol' : 'ul', 'statblock-forge__preview-tag-list');
        sample.values.forEach((entry) => list.append(make('li', sample.look === 'chips' ? 'is-chip' : '', entry)));
        value.append(list);
      }
      tags.append(value);
      block.append(tags);
      break;
    }
    case 'scores': {
      const samples = pt
        ? [
            { columns: ['Atributo', 'Valor', 'Mod.'], rows: [['Força', '18', '+4'], ['Destreza', '14', '+2']], lines: false },
            { columns: ['Perícia', 'Bônus'], rows: [['Atletismo', '+6'], ['Arcanismo', '+3'], ['Percepção', '+5']], lines: true },
            { columns: ['Ataque', 'Dano', 'Alcance'], rows: [['Mordida', '2d8+4', '1,5 m'], ['Cauda', '1d6+4', '3 m']], lines: false },
          ]
        : [
            { columns: ['Ability', 'Score', 'Mod.'], rows: [['Strength', '18', '+4'], ['Dexterity', '14', '+2']], lines: false },
            { columns: ['Skill', 'Bonus'], rows: [['Athletics', '+6'], ['Arcana', '+3'], ['Perception', '+5']], lines: true },
            { columns: ['Attack', 'Damage', 'Reach'], rows: [['Bite', '2d8+4', '5 ft.'], ['Tail', '1d6+4', '10 ft.']], lines: false },
          ];
      const sample = samples[variant % samples.length]!;
      const scores = make('div', 'statblock-forge__preview-scores');
      appendScoreTable(scores, sample.columns, sample.rows, sample.lines);
      block.append(scores);
      break;
    }
    case 'entries': {
      const entries = make('div', 'statblock-forge__preview-entries');
      const list = make('div', 'statblock-forge__preview-entry-list');
      if (variant % 3 === 0) {
        appendEntryExample(list, pt ? 'Mordida' : 'Bite', pt ? 'Ataque corpo a corpo: +6 para acertar, alcance 1,5 m.' : 'Melee attack: +6 to hit, reach 5 ft.', [[pt ? 'Dano' : 'Damage', '2d8+4'], [pt ? 'Tipo' : 'Type', pt ? 'Perfurante' : 'Piercing']]);
        appendEntryExample(list, pt ? 'Rugido' : 'Roar', pt ? 'Criaturas próximas fazem um teste de resistência.' : 'Nearby creatures make a saving throw.', [[pt ? 'Recarga' : 'Recharge', '5–6']]);
      } else if (variant % 3 === 1) {
        appendEntryExample(list, pt ? 'Resistência lendária' : 'Legendary Resistance', pt ? 'Se falhar em um teste, pode escolher obter sucesso.' : 'If it fails a saving throw, it can choose to succeed.', [[pt ? 'Usos' : 'Uses', '3'], [pt ? 'Recuperação' : 'Recovery', pt ? 'Descanso longo' : 'Long rest']]);
      } else {
        appendEntryExample(list, pt ? 'Rajada arcana' : 'Arcane Burst', pt ? 'Dispara energia contra um alvo à distância.' : 'Launches energy at a distant target.', [[pt ? 'Alcance' : 'Range', pt ? '18 m' : '60 ft.'], [pt ? 'Dano' : 'Damage', '3d6']]);
        appendEntryExample(list, pt ? 'Passo sombrio' : 'Shadow Step', pt ? 'Teleporta-se entre áreas de penumbra.' : 'Teleports between areas of dim light.', [[pt ? 'Uso' : 'Uses', '1/dia']]);
      }
      entries.append(list);
      block.append(entries);
      break;
    }
    case 'pairs': {
      const samples: Array<{ label: string; pairs: Array<[string, string]> }> = pt
        ? [
            { label: 'Testes de Resistência', pairs: [['Força', '+4'], ['Constituição', '+6'], ['Sabedoria', '+2']] },
            { label: 'Perícias', pairs: [['Furtividade', '+7'], ['Percepção', '+5'], ['Intuição', '+3']] },
            { label: 'Ataques', pairs: [['Mordida', '2d8+4'], ['Garras', '1d6+4']] },
          ]
        : [
            { label: 'Saving Throws', pairs: [['Strength', '+4'], ['Constitution', '+6'], ['Wisdom', '+2']] },
            { label: 'Skills', pairs: [['Stealth', '+7'], ['Perception', '+5'], ['Insight', '+3']] },
            { label: 'Attacks', pairs: [['Bite', '2d8+4'], ['Claws', '1d6+4']] },
          ];
      const sample = samples[variant % samples.length]!;
      appendPairExample(block, sample.label, sample.pairs);
      break;
    }
    case 'dice': {
      const samples: Array<[string, string]> = pt
        ? [['Ataque corpo a corpo', '1d20+6'], ['Dano de mordida', '2d8+4'], ['Dano de sopro', '8d6']]
        : [['Melee attack', '1d20+6'], ['Bite damage', '2d8+4'], ['Breath damage', '8d6']];
      const sample = samples[variant % samples.length]!;
      const dice = make('div', 'statblock-forge__help-dice');
      dice.append(make('span', 'statblock-forge__preview-field-label', sample[0]));
      const value = make('strong');
      appendDiceLink(value, sample[1]);
      dice.append(value);
      block.append(dice);
      break;
    }
    case 'choice': {
      const samples = pt
        ? [{ selected: 'Grande', options: ['Pequeno', 'Médio', 'Grande'] }, { selected: 'Neutro', options: ['Leal', 'Neutro', 'Caótico'] }]
        : [{ selected: 'Large', options: ['Small', 'Medium', 'Large'] }, { selected: 'Neutral', options: ['Lawful', 'Neutral', 'Chaotic'] }];
      const sample = samples[variant % samples.length]!;
      appendStatExample(block, pt ? (variant % 2 ? 'Tendência' : 'Tamanho') : (variant % 2 ? 'Alignment' : 'Size'), sample.selected);
      const choices = make('div', 'statblock-forge__help-choices');
      sample.options.forEach((option) => choices.append(make('span', `statblock-forge__help-choice-value${option === sample.selected ? ' is-selected' : ''}`, option)));
      block.append(choices);
      break;
    }
    case 'image': {
      const samples = pt
        ? [{ shape: 'portrait', label: 'Retrato' }, { shape: 'token', label: 'Token' }, { shape: 'portrait', label: 'Arte da criatura' }]
        : [{ shape: 'portrait', label: 'Portrait' }, { shape: 'token', label: 'Token' }, { shape: 'portrait', label: 'Creature art' }];
      const sample = samples[variant % samples.length]!;
      const image = make('div', `statblock-forge__preview-image is-${sample.shape}`);
      const placeholder = make('div', `statblock-forge__preview-image-empty statblock-forge__help-image-art is-${sample.shape}`);
      placeholder.append(make('span', 'statblock-forge__help-image-silhouette'), make('small', '', sample.label));
      image.append(placeholder);
      block.append(image);
      break;
    }
    case 'spells': {
      if (variant % 3 === 0) {
        const spells = make('div', 'statblock-forge__preview-spells');
        appendSpellExample(spells, pt ? 'Conjuração inata' : 'Innate Spellcasting', [
          [pt ? 'À vontade' : 'At will', pt ? 'Luz' : 'Light'],
          [pt ? '1/dia' : '1/day', pt ? 'Curar ferimentos (2d8)' : 'Cure wounds (2d8)'],
        ]);
        block.append(spells);
      } else if (variant % 3 === 1) {
        const spells = make('div', 'statblock-forge__preview-spells');
        appendSpellExample(spells, pt ? 'Conjurador de 5º nível' : '5th-level spellcaster', [
          [pt ? 'Truques' : 'Cantrips', pt ? 'Raio de fogo' : 'Fire bolt'],
          [pt ? '1º círculo' : '1st level', pt ? 'Mísseis mágicos' : 'Magic missile'],
          [pt ? '2º círculo' : '2nd level', pt ? 'Invisibilidade' : 'Invisibility'],
        ]);
        block.append(spells);
      } else {
        const spells = make('div', 'statblock-forge__preview-spells');
        appendSpellExample(spells, pt ? 'Magias preparadas' : 'Prepared Spells', [
          [pt ? '1º círculo' : '1st level', pt ? 'Detectar magia' : 'Detect magic'],
          [pt ? '1º círculo' : '1st level', pt ? 'Onda trovejante (3d8)' : 'Thunderwave (3d8)'],
          [pt ? '2º círculo' : '2nd level', pt ? 'Passo nebuloso' : 'Misty step'],
        ], true);
        block.append(spells);
      }
      break;
    }
    case 'checkboxes': {
      const variants = pt
        ? [
            [['Proficiência', true], ['Especialização', false], ['Inspiração', true]] as Array<[string, boolean]>,
            [['Resistência ao fogo', true], ['Visão no escuro', true]] as Array<[string, boolean]>,
            [['Preparado', false], ['Concentrado', true], ['Ritual', false]] as Array<[string, boolean]>,
          ]
        : [
            [['Proficient', true], ['Expertise', false], ['Inspiration', true]] as Array<[string, boolean]>,
            [['Fire resistance', true], ['Darkvision', true]] as Array<[string, boolean]>,
            [['Prepared', false], ['Concentrating', true], ['Ritual', false]] as Array<[string, boolean]>,
          ];
      const checks = make('div', 'statblock-forge__preview-checkboxes');
      const list = make('div', 'statblock-forge__preview-checkboxes-list');
      variants[variant % variants.length]!.forEach(([label, checked]) => {
        const item = make('label', 'statblock-forge__preview-checkbox-option');
        const input = make('input');
        input.type = 'checkbox';
        input.checked = checked;
        item.append(input, document.createTextNode(label));
        list.append(item);
      });
      checks.append(list);
      block.append(checks);
      break;
    }
    case 'counters': {
      const variants = pt
        ? [
            [{ name: 'Cargas', max: 4, used: 1, numeric: false }],
            [{ name: 'Pontos de Foco', max: 12, used: 5, numeric: true }],
            [{ name: 'Canalizar Divindade', max: 2, used: 0, numeric: false }, { name: 'Inspiração', max: 3, used: 2, numeric: false }],
          ]
        : [
            [{ name: 'Charges', max: 4, used: 1, numeric: false }],
            [{ name: 'Focus Points', max: 12, used: 5, numeric: true }],
            [{ name: 'Channel Divinity', max: 2, used: 0, numeric: false }, { name: 'Inspiration', max: 3, used: 2, numeric: false }],
          ];
      const counters = make('div', 'statblock-forge__preview-counters atlas-sb-counters');
      const body = make('span', 'atlas-sb-counters__body');
      const cells = make('span', 'atlas-sb-counters__cells');
      variants[variant % variants.length]!.forEach((sample) => appendCounterExample(cells, sample.name, sample.max, sample.used, sample.numeric));
      body.append(cells);
      counters.append(body);
      block.append(counters);
      break;
    }
    case 'track': {
      const track = make('div', 'statblock-forge__preview-track');
      track.append(make('strong', 'statblock-forge__preview-block-heading', pt ? 'Progresso' : 'Progress'));
      const pips = make('div', 'statblock-forge__help-track');
      for (let index = 0; index < 5; index += 1) pips.append(make('span', index < 3 ? 'is-filled' : ''));
      track.append(pips);
      block.append(track);
      break;
    }
    case 'section': {
      block.classList.add('is-section');
      appendSectionContents(block, pt ? [['FOR', '12'], ['DES', '14']] : [['STR', '12'], ['DEX', '14']], false, pt ? 'Atributos' : 'Attributes');
      break;
    }
    case 'row': {
      block.classList.add('is-row');
      const row = make('div', 'statblock-forge__preview-row align-start');
      const values: Array<[string, string]> = pt ? [['PV', '28'], ['CA', '16']] : [['HP', '28'], ['AC', '16']];
      values.forEach(([label, value]) => {
        const child = make('article', 'statblock-forge__preview-block is-stat');
        appendStatExample(child, label, value);
        child.setCssStyles({ flex: '0 1 calc(50% - 0.25rem)' });
        child.setCssStyles({ width: 'calc(50% - 0.25rem)' });
        child.setCssStyles({ minWidth: '0' });
        row.append(child);
      });
      block.append(row);
      break;
    }
    case 'tabs': {
      block.classList.add('is-tabs');
      const tabs = make('div', 'statblock-forge__preview-tabs');
      const strip = make('div', 'statblock-forge__preview-tab-strip');
      strip.setAttribute('role', 'tablist');
      const statsLabel = pt ? 'Atributos' : 'Stats';
      const abilitiesLabel = pt ? 'Habilidades' : 'Abilities';
      const active = make('span', 'statblock-forge__preview-tab is-active', statsLabel);
      active.setAttribute('role', 'tab');
      active.setAttribute('aria-selected', 'true');
      const inactive = make('span', 'statblock-forge__preview-tab', abilitiesLabel);
      inactive.setAttribute('role', 'tab');
      inactive.setAttribute('aria-selected', 'false');
      strip.append(active, inactive);
      const panels = make('div', 'statblock-forge__preview-tab-panels');
      const panel = make('div', 'statblock-forge__preview-tab-panel');
      panel.setAttribute('role', 'tabpanel');
      const sectionBlock = make('article', 'statblock-forge__preview-block is-section');
      appendSectionContents(sectionBlock, pt ? [['FOR', '+2'], ['DES', '+3']] : [['STR', '+2'], ['DEX', '+3']], true);
      panel.append(sectionBlock);
      panels.append(panel);
      tabs.append(strip, panels);
      block.append(tabs);
      break;
    }
  }

  root.append(block);
  return root;
}
