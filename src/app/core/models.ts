/** Uma pasta da carteira (subpasta de "MyDocs" no Google Drive). */
export interface DocFolder {
  id: string;
  name: string;
  /** Cor do cartão, guardada em appProperties no Drive. */
  color: string;
}

/** Um documento guardado na carteira. */
export interface DocItem {
  id: string;
  /** Nome identificador, ex.: "CNH Higor". */
  title: string;
  /** Nome do arquivo no Drive, ex.: "CNH Higor.pdf". */
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string;
  tags: string[];
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  /** Se o arquivo está compartilhado com alguém além do dono. */
  shared?: boolean;
}

/** Arquivo recebido pelo menu "Compartilhar" de outro app (ou escolhido no seletor). */
export interface IncomingFile {
  /** Caminho/URL local (Android/iOS) ou blob URL (web). */
  uri: string;
  name: string;
  mimeType: string;
  /** Preenchido quando o arquivo veio do seletor de arquivos (web/FAB). */
  blob?: Blob;
}

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
}

export const FOLDER_COLORS = [
  '#2563eb', // azul
  '#f59e0b', // âmbar
  '#10b981', // verde
  '#ef4444', // vermelho
  '#8b5cf6', // roxo
  '#ec4899', // rosa
  '#0ea5e9', // céu
  '#64748b', // ardósia
];

export type DocKind = 'pdf' | 'image' | 'sheet' | 'doc' | 'other';

export function kindOf(mimeType: string, fileName = ''): DocKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv' ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  )
    return 'sheet';
  if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx', 'odt', 'txt'].includes(ext))
    return 'doc';
  return 'other';
}

export const KIND_LABEL: Record<DocKind, string> = {
  pdf: 'PDF',
  image: 'Imagem',
  sheet: 'Planilha',
  doc: 'Documento',
  other: 'Arquivo',
};

export const KIND_ICON: Record<DocKind, string> = {
  pdf: 'document-text-outline',
  image: 'image-outline',
  sheet: 'grid-outline',
  doc: 'document-outline',
  other: 'attach-outline',
};

/** Normaliza uma tag para comparação ("  higor " → "higor"). */
export function tagKey(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function splitName(fileName: string): { base: string; ext: string } {
  const i = fileName.lastIndexOf('.');
  if (i <= 0) return { base: fileName, ext: '' };
  return { base: fileName.slice(0, i), ext: fileName.slice(i + 1) };
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
