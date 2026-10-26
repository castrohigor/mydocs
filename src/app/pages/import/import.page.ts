import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonProgressBar,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { DocsStore } from '../../core/docs.store';
import { FilesService } from '../../core/files.service';
import { IncomingFile, KIND_ICON, kindOf, splitName } from '../../core/models';
import { ShareInService } from '../../core/share-in.service';
import { pickFolder } from '../../components/folder-picker.modal';
import { TagInputComponent } from '../../components/tag-input.component';

const LAST_FOLDER_KEY = 'mydocs.lastFolder';

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
};

interface Draft {
  file: IncomingFile;
  title: string;
  ext: string;
  preview?: string;
  icon: string;
}

@Component({
  selector: 'app-import',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonIcon,
    IonNote,
    IonThumbnail,
    IonProgressBar,
    TagInputComponent,
  ],
  templateUrl: './import.page.html',
  styleUrl: './import.page.scss',
})
export class ImportPage implements OnInit, OnDestroy {
  store = inject(DocsStore);
  private shareIn = inject(ShareInService);
  private files = inject(FilesService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  drafts = signal<Draft[]>([]);
  folderId = signal<string | null>(null);
  tags = signal<string[]>([]);
  saving = signal(false);
  progress = signal(0);

  folder = computed(() => (this.folderId() ? this.store.folderById().get(this.folderId()!) : undefined));
  canSave = computed(
    () => !!this.folder() && this.drafts().length > 0 && this.drafts().every((d) => d.title.trim()) && !this.saving(),
  );

  async ngOnInit() {
    const incoming = this.shareIn.take();
    if (!incoming.length) {
      await this.router.navigateByUrl('/', { replaceUrl: true });
      return;
    }
    await this.store.load();

    this.drafts.set(
      incoming.map((file) => {
        const { base, ext } = splitName(file.name);
        const kind = kindOf(file.mimeType, file.name);
        return {
          file,
          title: base.replace(/[_-]+/g, ' ').trim(),
          ext: ext || EXT_BY_MIME[file.mimeType] || '',
          icon: KIND_ICON[kind],
        };
      }),
    );
    this.loadPreviews();

    const last = (await Preferences.get({ key: LAST_FOLDER_KEY })).value;
    if (last && this.store.folderById().has(last)) this.folderId.set(last);
  }

  ngOnDestroy() {
    this.drafts().forEach((d) => d.preview?.startsWith('blob:') && URL.revokeObjectURL(d.preview));
  }

  private async loadPreviews() {
    for (const d of this.drafts()) {
      if (!d.file.mimeType.startsWith('image/')) continue;
      try {
        const blob = await this.files.readIncoming(d.file);
        const preview = URL.createObjectURL(blob);
        this.drafts.update((list) => list.map((x) => (x === d ? { ...x, preview } : x)));
      } catch {
        /* sem pré-visualização */
      }
    }
  }

  setTitle(i: number, title: string) {
    this.drafts.update((list) => list.map((d, j) => (i === j ? { ...d, title } : d)));
  }

  removeDraft(i: number) {
    this.drafts.update((list) => list.filter((_, j) => j !== i));
    if (!this.drafts().length) void this.cancel();
  }

  async chooseFolder() {
    const id = await pickFolder(this.modalCtrl, { title: 'Arquivar em', current: this.folderId() ?? undefined });
    if (id) this.folderId.set(id);
  }

  async save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.progress.set(0);
    const total = this.drafts().length;
    let done = 0;
    try {
      for (const d of this.drafts()) {
        const blob = await this.files.readIncoming(d.file);
        const title = d.title.trim();
        await this.store.add(blob, {
          title,
          fileName: d.ext ? `${title}.${d.ext}` : title,
          mimeType: d.file.mimeType || blob.type || 'application/octet-stream',
          folderId: this.folderId()!,
          tags: this.tags(),
        });
        done++;
        this.progress.set(done / total);
      }
      await Preferences.set({ key: LAST_FOLDER_KEY, value: this.folderId()! });
      await this.toast(total === 1 ? 'Documento guardado no Drive.' : `${total} documentos guardados no Drive.`);
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (e) {
      // Remove da lista o que já foi salvo, para não duplicar ao tentar de novo.
      this.drafts.update((list) => list.slice(done));
      await this.toast(e instanceof Error ? e.message : 'Falha ao enviar para o Drive.', 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  async cancel() {
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }

  private async toast(message: string, color?: string) {
    const t = await this.toastCtrl.create({ message, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
