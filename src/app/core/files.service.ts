import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { DriveService } from './drive.service';
import { DocItem, IncomingFile } from './models';

/**
 * Cuida dos arquivos no aparelho: baixar do Drive para o cache,
 * abrir no app padrão e compartilhar vários de uma vez.
 */
@Injectable({ providedIn: 'root' })
export class FilesService {
  private drive = inject(DriveService);
  private native = Capacitor.isNativePlatform();

  /** Lê um arquivo recebido via "Compartilhar" (ou escolhido no seletor) como Blob. */
  async readIncoming(file: IncomingFile): Promise<Blob> {
    if (file.blob) return file.blob;
    try {
      const res = await fetch(this.native ? Capacitor.convertFileSrc(file.uri) : file.uri);
      if (res.ok) return await res.blob();
    } catch {
      /* tenta pelo Filesystem */
    }
    const path = file.uri.startsWith('/') ? `file://${file.uri}` : file.uri;
    const read = await Filesystem.readFile({ path });
    if (read.data instanceof Blob) return read.data;
    return this.base64ToBlob(read.data, file.mimeType);
  }

  /** Garante uma cópia local do documento e devolve a URI file://. */
  async ensureLocal(doc: DocItem): Promise<string> {
    const path = this.cachePath(doc);
    try {
      const { uri } = await Filesystem.stat({ path, directory: Directory.Cache });
      return uri;
    } catch {
      /* ainda não está em cache */
    }
    const blob = await this.drive.download(doc.id);
    const data = await this.blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
    return uri;
  }

  /** URL utilizável num <img> (pré-visualização). */
  async previewUrl(doc: DocItem): Promise<string> {
    if (this.native) return Capacitor.convertFileSrc(await this.ensureLocal(doc));
    return URL.createObjectURL(await this.drive.download(doc.id));
  }

  async open(doc: DocItem): Promise<void> {
    if (!this.native) {
      const url = URL.createObjectURL(await this.drive.download(doc.id));
      window.open(url, '_blank');
      return;
    }
    const path = await this.ensureLocal(doc);
    await FileOpener.openFile({ path, mimeType: doc.mimeType });
  }

  /**
   * Compartilha os arquivos de verdade (não links). No WhatsApp vão todos os
   * arquivos; no e-mail, todos viram anexos da mesma mensagem.
   */
  async shareFiles(docs: DocItem[]): Promise<void> {
    if (!docs.length) return;
    const title = docs.length === 1 ? docs[0].title : `${docs.length} documentos`;

    if (this.native) {
      const files = await Promise.all(docs.map((d) => this.ensureLocal(d)));
      await ignoreCancel(Share.share({ title, dialogTitle: `Compartilhar ${title}`, files }));
      return;
    }

    // Navegador: Web Share API com arquivos, senão baixa cada um.
    const blobs = await Promise.all(docs.map((d) => this.drive.download(d.id)));
    const files = blobs.map((b, i) => new File([b], docs[i].fileName, { type: docs[i].mimeType }));
    if (navigator.canShare?.({ files })) {
      await ignoreCancel(navigator.share({ files, title }));
    } else {
      files.forEach((f) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
      });
    }
  }

  async shareText(text: string, title?: string): Promise<void> {
    if (this.native) {
      await ignoreCancel(Share.share({ title, text, dialogTitle: title }));
    } else if (navigator.share) {
      await ignoreCancel(navigator.share({ title, text }));
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  async clearCache(): Promise<void> {
    try {
      await Filesystem.rmdir({ path: 'docs', directory: Directory.Cache, recursive: true });
    } catch {
      /* nada em cache */
    }
  }

  private cachePath(doc: DocItem) {
    const version = doc.modifiedTime.replace(/\D/g, '');
    const safeName = doc.fileName.replace(/[\\/:*?"<>|]/g, '_');
    return `docs/${doc.id}-${version}/${safeName}`;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(b64: string, type: string): Blob {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }
}

/** Fechar a folha de compartilhamento não é erro. */
async function ignoreCancel<T>(p: Promise<T>): Promise<void> {
  try {
    await p;
  } catch (e) {
    const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    if (/cancel|abort/i.test(msg)) return;
    throw e;
  }
}
