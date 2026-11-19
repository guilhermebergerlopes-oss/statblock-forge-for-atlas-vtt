/** Pure Save-dialog rules aligned with Atlas' template editor. */

export type TemplateSaveKind = 'update' | 'new';

export interface TemplateSaveSubject {
  name: string;
  unsaved: boolean;
}

export interface TemplateSaveChoice {
  kind: TemplateSaveKind;
  label: string;
  problem: string | null;
  hint: string | null;
}

export type TemplateNameTaken = (name: string) => boolean;
export type TemplateSaveLanguage = 'en' | 'pt-BR';

export function sameTemplateDisplayName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

/** Atlas rejects unsafe names instead of silently converting them to another filename. */
export function templateSaveNameProblem(value: string, language: TemplateSaveLanguage = 'pt-BR'): string | null {
  const name = value.trim();
  if (!name) return language === 'en' ? 'Enter a template name.' : 'Informe um nome para o template.';
  if (/[\\/:*?"<>|#^[\]]/.test(name)) return language === 'en' ? 'The name contains characters that cannot be used in file names.' : 'O nome contém caracteres que não podem ser usados em nomes de arquivos.';
  if (name.startsWith('.')) return language === 'en' ? 'The name cannot start with a dot.' : 'O nome não pode começar com ponto.';
  return null;
}

export function templateSaveChoice(
  subject: TemplateSaveSubject,
  typedName: string,
  taken: TemplateNameTaken,
  language: TemplateSaveLanguage = 'pt-BR',
): TemplateSaveChoice {
  const name = typedName.trim();
  if (!subject.unsaved && sameTemplateDisplayName(name, subject.name)) {
    return {
      kind: 'update',
      label: language === 'en' ? 'Update' : 'Atualizar',
      problem: null,
      hint: language === 'en'
        ? `Updates “${subject.name}” while keeping its ID and links from existing statblocks.`
        : `Atualiza “${subject.name}” mantendo o mesmo ID e os vínculos dos statblocks existentes.`,
    };
  }

  const problem = templateSaveNameProblem(name, language)
    ?? (taken(name) ? (language === 'en' ? `A template or note named “${name}” already exists. Choose another name.` : `Já existe um template ou nota com o nome “${name}”. Escolha outro nome.`) : null);

  if (subject.unsaved) {
    return { kind: 'new', label: language === 'en' ? 'Save' : 'Salvar', problem, hint: language === 'en' ? 'Creates the template file for the first time.' : 'Cria o arquivo do template pela primeira vez.' };
  }

  return {
    kind: 'new',
    label: language === 'en' ? 'Save as New' : 'Salvar como novo',
    problem,
    hint: language === 'en'
      ? `Creates a new template. “${subject.name}” stays unchanged and existing statblocks remain linked to it.`
      : `Cria um novo template. “${subject.name}” permanece inalterado e os statblocks existentes continuam vinculados a ele.`,
  };
}
