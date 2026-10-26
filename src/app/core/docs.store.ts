import { Injectable, computed, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { DriveService } from './drive.service';
import { DocFolder, DocItem, tagKey } from './models';

const CACHE_KEY = 'mydocs.index.v1';

/**
 * Estado da carteira: pastas, documentos e tags.
 * Abre instantaneamente a partir do índice salvo no aparelho e
 * sincroniza com o Google Drive em segundo plano.
 */
@Injectable({ providedIn: 'root' })
export class DocsStore {
  private drive = inject(DriveService);

  readonly folders = signal<DocFolder[]>([]);
  readonly docs = signal<DocItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastSync = signal<Date | null>(null);

  /** Todas as tags em uso, sem duplicatas (ignora maiúsculas/acentos), ordenadas por uso. */
  readonly allTags = computed(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const d of this.docs()) {
      for (const t of d.tags) {
        const k = tagKey(t);
        const cur = counts.get(k);
        counts.set(k, { label: cur?.label ?? t, n: (cur?.n ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((x) => x.label);
  });

  readonly folderById = computed(() => new Map(this.folders().map((f) => [f.id, f])));

  private cacheRead?: Promise<void>;

  /**
   * Carrega o índice salvo no aparelho (aguardado) e dispara a
   * sincronização com o Drive em segundo plano na primeira vez.
   */
  async load(): Promise<void> {
    if (!this.cacheRead) {
      this.cacheRead = (async () => {
        const cached = await Preferences.get({ key: CACHE_KEY });
        if (cached.value) {
          const c = JSON.parse(cached.value) as { folders: DocFolder[]; docs: DocItem[]; at: string };
          this.folders.set(c.folders);
          this.docs.set(c.docs);
          this.lastSync.set(new Date(c.at));
        }
      })();
      await this.cacheRead;
      void this.refresh();
    }
    await this.cacheRead;
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [folders, docs] = await Promise.all([this.drive.listFolders(), this.drive.listDocs()]);
      this.folders.set(folders);
      this.docs.set(this.sortDocs(docs));
      this.lastSync.set(new Date());
      await this.persist();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  clear() {
    this.folders.set([]);
    this.docs.set([]);
    this.cacheRead = undefined;
    void Preferences.remove({ key: CACHE_KEY });
  }

  // ---------- Pastas ----------

  async createFolder(name: string, color?: string): Promise<DocFolder> {
    const existing = this.folders().find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing;
    const folder = await this.drive.createFolder(name.trim(), color);
    this.folders.update((list) => [...list, folder].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    await this.persist();
    return folder;
  }

  async updateFolder(id: string, changes: { name?: string; color?: string }) {
    const updated = await this.drive.updateFolder(id, changes);
    this.folders.update((list) => list.map((f) => (f.id === id ? updated : f)));
    await this.persist();
  }

  async deleteFolder(id: string) {
    await this.drive.trashFolder(id);
    this.folders.update((list) => list.filter((f) => f.id !== id));
    this.docs.update((list) => list.filter((d) => d.folderId !== id));
    await this.persist();
  }

  // ---------- Documentos ----------

  async add(
    blob: Blob,
    meta: { title: string; fileName: string; mimeType: string; folderId: string; tags: string[] },
  ): Promise<DocItem> {
    const doc = await this.drive.upload(blob, meta);
    this.docs.update((list) => this.sortDocs([doc, ...list]));
    await this.persist();
    return doc;
  }

  async update(doc: DocItem, changes: { title?: string; tags?: string[] }): Promise<DocItem> {
    const updated = await this.drive.updateDoc(doc, changes);
    this.replace(updated);
    return updated;
  }

  async move(docs: DocItem[], folderId: string): Promise<void> {
    const moved = await Promise.all(docs.filter((d) => d.folderId !== folderId).map((d) => this.drive.moveDoc(d, folderId)));
    moved.forEach((d) => this.replace(d, false));
    await this.persist();
  }

  /** Adiciona/remove tags em lote. */
  async retag(docs: DocItem[], add: string[], remove: string[]): Promise<void> {
    const removeKeys = new Set(remove.map(tagKey));
    const updated = await Promise.all(
      docs.map((d) => {
        const kept = d.tags.filter((t) => !removeKeys.has(tagKey(t)));
        const keys = new Set(kept.map(tagKey));
        const tags = [...kept, ...add.filter((t) => !keys.has(tagKey(t)))];
        return this.drive.updateDoc(d, { tags });
      }),
    );
    updated.forEach((d) => this.replace(d, false));
    await this.persist();
  }

  async remove(docs: DocItem[]): Promise<void> {
    await Promise.all(docs.map((d) => this.drive.trashDoc(d.id)));
    const ids = new Set(docs.map((d) => d.id));
    this.docs.update((list) => list.filter((d) => !ids.has(d.id)));
    await this.persist();
  }

  markShared(id: string) {
    this.docs.update((list) => list.map((d) => (d.id === id ? { ...d, shared: true } : d)));
  }

  get(id: string): DocItem | undefined {
    return this.docs().find((d) => d.id === id);
  }

  private replace(doc: DocItem, persist = true) {
    this.docs.update((list) => this.sortDocs(list.map((d) => (d.id === doc.id ? doc : d))));
    if (persist) void this.persist();
  }

  private sortDocs(list: DocItem[]) {
    return [...list].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
  }

  private persist() {
    return Preferences.set({
      key: CACHE_KEY,
      value: JSON.stringify({ folders: this.folders(), docs: this.docs(), at: new Date().toISOString() }),
    });
  }
}
