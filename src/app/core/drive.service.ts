import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { DocFolder, DocItem, DrivePermission, FOLDER_COLORS } from './models';
import { environment } from '../../environments/environment';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Marcadores gravados em appProperties (invisíveis para outros apps). */
const PROP_ROLE = 'mydocsRole'; // 'root' | 'folder' | 'doc'
const PROP_TITLE = 'mydocsTitle';
const PROP_COLOR = 'mydocsColor';

const FILE_FIELDS =
  'id,name,mimeType,size,parents,description,appProperties,createdTime,modifiedTime,webViewLink,thumbnailLink,shared,trashed';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  description?: string;
  appProperties?: Record<string, string>;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  shared?: boolean;
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Acesso à API REST do Google Drive v3.
 *
 * Estrutura no Drive:
 *   MyDocs/                 ← pasta raiz (appProperties.mydocsRole = root)
 *     Pessoais/             ← "pastas" da carteira (mydocsRole = folder)
 *       CNH Higor.pdf       ← documentos (mydocsRole = doc)
 *
 * As tags ficam na descrição do arquivo ("#Higor #Comprovantes"), então
 * também aparecem — e podem ser pesquisadas — no próprio Google Drive.
 */
@Injectable({ providedIn: 'root' })
export class DriveService {
  private auth = inject(AuthService);
  private rootId?: string;

  // ---------- HTTP ----------

  private async request<T>(url: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (res.status === 401 && retry) {
      await this.auth.getAccessToken(true);
      return this.request<T>(url, init, false);
    }
    if (!res.ok) {
      let msg = `Erro ${res.status} no Google Drive`;
      try {
        const body = await res.json();
        msg = body?.error?.message ?? msg;
      } catch {
        /* sem corpo JSON */
      }
      throw new DriveError(msg, res.status);
    }
    if (res.status === 204) return undefined as T;
    const type = res.headers.get('content-type') ?? '';
    return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>;
  }

  private json(body: unknown, method = 'POST'): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  private async listAll(q: string): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: '1000',
        spaces: 'drive',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await this.request<{ files: DriveFile[]; nextPageToken?: string }>(`${API}/files?${params}`);
      out.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  }

  // ---------- Pasta raiz ----------

  async ensureRoot(): Promise<string> {
    if (this.rootId) return this.rootId;
    const found = await this.listAll(
      `trashed = false and mimeType = '${FOLDER_MIME}' and appProperties has { key='${PROP_ROLE}' and value='root' }`,
    );
    if (found.length) {
      this.rootId = found[0].id;
    } else {
      const created = await this.request<DriveFile>(
        `${API}/files?fields=id`,
        this.json({
          name: environment.driveRootFolderName,
          mimeType: FOLDER_MIME,
          appProperties: { [PROP_ROLE]: 'root' },
        }),
      );
      this.rootId = created.id;
    }
    return this.rootId!;
  }

  // ---------- Pastas ----------

  async listFolders(): Promise<DocFolder[]> {
    await this.ensureRoot();
    const files = await this.listAll(
      `trashed = false and mimeType = '${FOLDER_MIME}' and appProperties has { key='${PROP_ROLE}' and value='folder' }`,
    );
    return files.map((f) => this.toFolder(f)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async createFolder(name: string, color?: string): Promise<DocFolder> {
    const root = await this.ensureRoot();
    const f = await this.request<DriveFile>(
      `${API}/files?fields=${FILE_FIELDS}`,
      this.json({
        name,
        mimeType: FOLDER_MIME,
        parents: [root],
        appProperties: {
          [PROP_ROLE]: 'folder',
          [PROP_COLOR]: color ?? FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)],
        },
      }),
    );
    return this.toFolder(f);
  }

  async updateFolder(id: string, changes: { name?: string; color?: string }): Promise<DocFolder> {
    const body: Record<string, unknown> = {};
    if (changes.name) body['name'] = changes.name;
    if (changes.color) body['appProperties'] = { [PROP_COLOR]: changes.color };
    const f = await this.request<DriveFile>(`${API}/files/${id}?fields=${FILE_FIELDS}`, this.json(body, 'PATCH'));
    return this.toFolder(f);
  }

  /** Move a pasta (e o que estiver dentro) para a lixeira do Drive. */
  async trashFolder(id: string): Promise<void> {
    await this.request(`${API}/files/${id}`, this.json({ trashed: true }, 'PATCH'));
  }

  // ---------- Documentos ----------

  async listDocs(): Promise<DocItem[]> {
    const files = await this.listAll(
      `trashed = false and appProperties has { key='${PROP_ROLE}' and value='doc' }`,
    );
    return files.map((f) => this.toDoc(f));
  }

  async upload(
    file: Blob,
    meta: { title: string; fileName: string; mimeType: string; folderId: string; tags: string[] },
  ): Promise<DocItem> {
    const metadata = {
      name: meta.fileName,
      mimeType: meta.mimeType,
      parents: [meta.folderId],
      description: this.tagsToDescription(meta.tags),
      appProperties: { [PROP_ROLE]: 'doc', [PROP_TITLE]: meta.title.slice(0, 100) },
    };
    const boundary = `mydocs-${Math.random().toString(36).slice(2)}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${meta.mimeType || 'application/octet-stream'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ]);
    const f = await this.request<DriveFile>(`${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return this.toDoc(f);
  }

  /** Renomear e/ou re-taguear. */
  async updateDoc(doc: DocItem, changes: { title?: string; tags?: string[] }): Promise<DocItem> {
    const body: Record<string, unknown> = {};
    if (changes.title !== undefined) {
      const ext = doc.fileName.includes('.') ? doc.fileName.slice(doc.fileName.lastIndexOf('.')) : '';
      body['name'] = changes.title + ext;
      body['appProperties'] = { [PROP_TITLE]: changes.title.slice(0, 100) };
    }
    if (changes.tags !== undefined) body['description'] = this.tagsToDescription(changes.tags);
    const f = await this.request<DriveFile>(
      `${API}/files/${doc.id}?fields=${FILE_FIELDS}`,
      this.json(body, 'PATCH'),
    );
    return this.toDoc(f);
  }

  async moveDoc(doc: DocItem, toFolderId: string): Promise<DocItem> {
    const params = new URLSearchParams({ addParents: toFolderId, removeParents: doc.folderId, fields: FILE_FIELDS });
    const f = await this.request<DriveFile>(`${API}/files/${doc.id}?${params}`, this.json({}, 'PATCH'));
    return this.toDoc(f);
  }

  /** Remove para a lixeira do Drive (recuperável por 30 dias). */
  async trashDoc(id: string): Promise<void> {
    await this.request(`${API}/files/${id}`, this.json({ trashed: true }, 'PATCH'));
  }

  async download(id: string): Promise<Blob> {
    return this.request<Blob>(`${API}/files/${id}?alt=media`);
  }

  // ---------- Compartilhamento estilo Google Drive ----------

  async listPermissions(id: string): Promise<DrivePermission[]> {
    const res = await this.request<{ permissions: DrivePermission[] }>(
      `${API}/files/${id}/permissions?fields=permissions(id,type,role,emailAddress,displayName)`,
    );
    return res.permissions;
  }

  /** Dá acesso a uma pessoa pelo e-mail (o Google envia o convite). */
  async shareWithEmail(id: string, email: string, role: 'reader' | 'writer', message?: string): Promise<void> {
    const params = new URLSearchParams({ sendNotificationEmail: 'true' });
    if (message) params.set('emailMessage', message);
    await this.request(
      `${API}/files/${id}/permissions?${params}`,
      this.json({ type: 'user', role, emailAddress: email }),
    );
  }

  /** "Qualquer pessoa com o link pode ver". Devolve o link. */
  async enableLinkSharing(id: string): Promise<string> {
    await this.request(`${API}/files/${id}/permissions`, this.json({ type: 'anyone', role: 'reader' }));
    const f = await this.request<DriveFile>(`${API}/files/${id}?fields=webViewLink`);
    return f.webViewLink!;
  }

  async removePermission(fileId: string, permissionId: string): Promise<void> {
    await this.request(`${API}/files/${fileId}/permissions/${permissionId}`, { method: 'DELETE' });
  }

  // ---------- Conversões ----------

  private toFolder(f: DriveFile): DocFolder {
    return { id: f.id, name: f.name, color: f.appProperties?.[PROP_COLOR] ?? FOLDER_COLORS[0] };
  }

  private toDoc(f: DriveFile): DocItem {
    const title = f.appProperties?.[PROP_TITLE] ?? f.name.replace(/\.[^.]+$/, '');
    return {
      id: f.id,
      title,
      fileName: f.name,
      mimeType: f.mimeType,
      size: Number(f.size ?? 0),
      folderId: f.parents?.[0] ?? '',
      tags: this.descriptionToTags(f.description),
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      thumbnailLink: f.thumbnailLink,
      shared: f.shared,
    };
  }

  private tagsToDescription(tags: string[]): string {
    return tags.map((t) => '#' + t.trim().replace(/\s+/g, '_')).join(' ');
  }

  private descriptionToTags(desc?: string): string[] {
    if (!desc) return [];
    return (desc.match(/#[^\s#]+/g) ?? []).map((t) => t.slice(1).replace(/_/g, ' '));
  }
}
