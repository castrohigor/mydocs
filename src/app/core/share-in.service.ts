import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { CapacitorShareTarget } from '@capgo/capacitor-share-target';
import { IncomingFile } from './models';

/**
 * Recebe arquivos enviados pelo menu "Compartilhar" de outros apps
 * (Android: intent SEND/SEND_MULTIPLE · iOS: Share Extension) e abre
 * a tela de arquivamento.
 */
@Injectable({ providedIn: 'root' })
export class ShareInService {
  private router = inject(Router);

  /** Arquivos aguardando serem arquivados. */
  readonly pending = signal<IncomingFile[]>([]);

  async listen(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await CapacitorShareTarget.addListener('shareReceived', (event) => {
      const files = (event.files ?? []).map((f) => ({
        uri: f.uri,
        name: f.name || 'documento',
        mimeType: f.mimeType || 'application/octet-stream',
      }));
      if (files.length) this.receive(files);
    });
  }

  /** Também usado pelo botão "+" (arquivos escolhidos no aparelho). */
  receive(files: IncomingFile[]) {
    this.pending.set(files);
    void this.router.navigateByUrl('/import');
  }

  take(): IncomingFile[] {
    const files = this.pending();
    this.pending.set([]);
    return files;
  }
}
