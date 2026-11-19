/**
 * Public integration surface documented by Atlas VTT.
 *
 * This is deliberately a capability report, not runtime feature detection. It
 * records only interfaces that Atlas documents as safe for other projects to
 * consume. A missing public API is reported as undocumented, never guessed
 * from private stores, React components, or internal plugin properties.
 */
export type AtlasCapabilityStatus =
  | 'documented'
  | 'browser-extension-only'
  | 'not-documented';

export interface AtlasPublicCapability {
  readonly id: string;
  readonly label: string;
  readonly status: AtlasCapabilityStatus;
  readonly explanation: string;
  readonly integration: string;
}

export const ATLAS_PUBLIC_CAPABILITIES: readonly AtlasPublicCapability[] = [
  {
    id: 'template-files',
    label: 'Templates nativos',
    status: 'documented',
    explanation: 'A biblioteca nativa do Atlas procura templates JSON com extensão .atlastemplate em qualquer pasta do Vault; arquivos .forgetemplate não são reconhecidos diretamente.',
    integration: 'O Forge mantém seus próprios statblocks vinculados a .forgetemplate e os abre em seu editor independente. A exportação para Atlas continua sendo uma ação separada que gera .atlastemplate.',
  },
  {
    id: 'token-from-statblock-command',
    label: 'Criação e associação de token a partir do statblock',
    status: 'documented',
    explanation: 'Atlas documenta o comando “Create token from statblock image”: com uma nota statblock ativa e uma imagem local no Vault, cria um token e já o vincula à nota.',
    integration: 'O Forge abre a nota publicada e tenta acionar o comando visível do Atlas quando o gerenciador de comandos do Obsidian está disponível; caso contrário, orienta a execução manual. Tokens já existentes continuam usando “Link Statblock”.',
  },
  {
    id: 'native-statblock-editor',
    label: 'Editor nativo experimental de statblocks',
    status: 'documented',
    explanation: 'Atlas documenta um editor experimental de statblocks para notas que usam templates nativos .atlastemplate.',
    integration: 'O Forge não tenta acionar o painel interno do Atlas para uma nota ligada a .forgetemplate. Em vez disso, mantém o YAML na nota Markdown e exibe o painel editável do Forge junto dela, na mesma aba do Obsidian, usando o template Forge original.',
  },
  {
    id: 'native-ability-parts',
    label: 'Ability Parts nativas',
    status: 'documented',
    explanation: 'O formato verificado do Atlas aceita text, number, list, dice e choice nas partes de Entries.',
    integration: 'Esses tipos são exportados diretamente. Counter do Forge é projetado como text para o Atlas e restaurado como marcas ao abrir a mesma nota no Forge.',
  },
  {
    id: 'browser-named-rolls',
    label: 'Rolagens nomeadas na página de jogadores',
    status: 'browser-extension-only',
    explanation: 'A ponte documentada conecta uma ficha web à aba do Atlas por uma extensão de navegador e mensagens entre abas.',
    integration: 'Não é uma API de plugin Obsidian nem registra componentes de ficha.',
  },
  {
    id: 'custom-renderer',
    label: 'Registro de renderizadores de statblock',
    status: 'not-documented',
    explanation: 'Não foi encontrada uma API pública documentada para registrar renderizadores externos ou substituir o renderizador nativo.',
    integration: 'O Forge mantém seu próprio renderizador e sua prévia independente.',
  },
  {
    id: 'ability-part-extension',
    label: 'Novos tipos de Ability Part',
    status: 'not-documented',
    explanation: 'Não foi encontrada uma API pública documentada para registrar tipos personalizados ou editores de campos no editor nativo do Atlas.',
    integration: 'O Forge não injeta componentes no Atlas. Habilidades exclusivas são convertidas por adaptadores de arquivo quando existe uma representação textual reversível; os demais tipos desconhecidos são preservados e sinalizados.',
  },
  {
    id: 'online-character-sync',
    label: 'Sincronização online de personagens e Counters',
    status: 'not-documented',
    explanation: 'Não foi encontrada uma API pública para plugins externos lerem ou alterarem o estado online de personagens, recursos ou Counters.',
    integration: 'A etapa 6 continuará bloqueada até existir uma interface pública documentada e permissões verificáveis.',
  },
] as const;

export function getAtlasPublicCapabilityReport(): readonly AtlasPublicCapability[] {
  return ATLAS_PUBLIC_CAPABILITIES;
}
