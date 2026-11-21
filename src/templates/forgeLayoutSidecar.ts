import {
  createForgeLayout,
  isRecord,
  parseForgeLayout,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';

export type ForgeLayoutSidecarStatus =
  | 'valid'
  | 'invalid-json'
  | 'invalid-root'
  | 'unsupported-format'
  | 'unsupported-version'
  | 'template-mismatch'
  | 'invalid-block-map';

export interface ForgeLayoutSidecarInspection {
  status: ForgeLayoutSidecarStatus;
  layout?: ForgeLayoutDocument;
  message?: string;
}

/** Inspect the external Forge layout kept beside a native `.atlastemplate`. */
export function inspectForgeLayoutSidecarText(
  text: string,
  template: ForgeTemplate,
): ForgeLayoutSidecarInspection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { status: 'invalid-json', message: 'O sidecar de layout não contém JSON válido.' };
  }
  if (!isRecord(parsed)) {
    return { status: 'invalid-root', message: 'A raiz do sidecar de layout precisa ser um objeto JSON.' };
  }
  if (parsed.format !== 'statblock-forge-layout') {
    return { status: 'unsupported-format', message: 'O sidecar não declara o formato de layout do Forge.' };
  }
  if (parsed.version !== 1) {
    return { status: 'unsupported-version', message: `O sidecar usa a versão ${String(parsed.version)}; esta versão do Forge só pode ler a versão 1.` };
  }
  if (parsed.templateId !== template.id) {
    return { status: 'template-mismatch', message: 'O sidecar pertence a outro Template. O layout original foi protegido.' };
  }
  if (!isRecord(parsed.blocks)) {
    return { status: 'invalid-block-map', message: 'O sidecar não contém um mapa válido de metadados dos blocos.' };
  }
  return { status: 'valid', layout: parseForgeLayout(text, template) };
}

export interface AtlasTemplateLayoutResolution {
  layout: ForgeLayoutDocument;
  source: 'embedded' | 'sidecar' | 'default';
  warning?: string;
}

/** Resolve the Forge layout when an Atlas template is copied into a Forge file. */
export function resolveAtlasTemplateLayoutForForgeCopy(
  template: ForgeTemplate,
  embeddedLayout: ForgeLayoutDocument | null,
  sidecarText?: string | null,
): AtlasTemplateLayoutResolution {
  if (embeddedLayout) return { layout: embeddedLayout, source: 'embedded' };
  if (sidecarText === undefined || sidecarText === null) {
    return { layout: createForgeLayout(template), source: 'default' };
  }
  const inspected = inspectForgeLayoutSidecarText(sidecarText, template);
  if (inspected.status === 'valid' && inspected.layout) {
    return { layout: inspected.layout, source: 'sidecar' };
  }
  return {
    layout: createForgeLayout(template),
    source: 'default',
    warning: inspected.message ?? 'O sidecar do Forge não pôde ser carregado; o layout padrão foi usado. O arquivo original não foi alterado.',
  };
}
