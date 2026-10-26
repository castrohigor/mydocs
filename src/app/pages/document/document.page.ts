import { Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { DocsStore } from '../../core/docs.store';
import { FilesService } from '../../core/files.service';
import { formatSize, KIND_LABEL, kindOf } from '../../core/models';
import { pickFolder } from '../../components/folder-picker.modal';
import { DriveShareModal } from '../../components/drive-share.modal';
import { RetagResult, TagsModal } from '../../components/tags.modal';
import { WalletCardComponent } from '../../components/wallet-card.component';

@Component({
  selector: 'app-document',
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonChip,
    IonSpinner,
    WalletCardComponent,
  ],
  templateUrl: './document.page.html',
  styleUrl: './document.page.scss',
})
export class DocumentPage implements OnDestroy {
  store = inject(DocsStore);
  private files = inject(FilesService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  /** Vem da rota /doc/:id */
  id = input.required<string>();

  doc = computed(() => this.store.docs().find((d) => d.id === this.id()));
  folder = computed(() => (this.doc() ? this.store.folderById().get(this.doc()!.folderId) : undefined));
  kind = computed(() => (this.doc() ? kindOf(this.doc()!.mimeType, this.doc()!.fileName) : 'other'));
  kindLabel = computed(() => KIND_LABEL[this.kind()]);
  size = computed(() => formatSize(this.doc()?.size ?? 0));

  preview = signal<string | null>(null);
  previewLoading = signal(false);
  private previewFor?: string;

  constructor() {
    void this.store.load();
    effect(() => {
      const d = this.doc();
      if (!d || this.kind() !== 'image') return;
      const key = d.id + d.modifiedTime;
      if (this.previewFor === key) return;
      this.previewFor = key;
      this.previewLoading.set(true);
      this.files
        .previewUrl(d)
        .then((url) => this.preview.set(url))
        .catch(() => this.preview.set(null))
        .finally(() => this.previewLoading.set(false));
    });
  }

  ngOnDestroy() {
    const p = this.preview();
    if (p?.startsWith('blob:')) URL.revokeObjectURL(p);
  }

  async open() {
    await this.busy('Abrindo…', () => this.files.open(this.doc()!));
  }

  async sendFile() {
    await this.busy('Preparando…', () => this.files.shareFiles([this.doc()!]));
  }

  async shareDrive() {
    const m = await this.modalCtrl.create({ component: DriveShareModal, componentProps: { doc: this.doc() } });
    await m.present();
  }

  openInDrive() {
    const link = this.doc()?.webViewLink;
    if (link) window.open(link, '_system');
  }

  async rename() {
    const d = this.doc()!;
    const a = await this.alertCtrl.create({
      header: 'Renomear',
      inputs: [{ name: 'title', value: d.title, placeholder: 'Ex.: CNH Higor', attributes: { autocapitalize: 'words' } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Salvar', role: 'confirm' },
      ],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss<{ values: { title: string } }>();
    const title = data?.values?.title?.trim();
    if (role !== 'confirm' || !title || title === d.title) return;
    await this.busy('Salvando…', () => this.store.update(d, { title }));
  }

  async move() {
    const d = this.doc()!;
    const folderId = await pickFolder(this.modalCtrl, { title: 'Mover para', current: d.folderId });
    if (!folderId || folderId === d.folderId) return;
    await this.busy('Movendo…', () => this.store.move([d], folderId));
  }

  async editTags() {
    const d = this.doc()!;
    const m = await this.modalCtrl.create({ component: TagsModal, componentProps: { docs: [d] } });
    await m.present();
    const { data, role } = await m.onWillDismiss<RetagResult>();
    if (role !== 'save' || !data) return;
    await this.busy('Salvando…', () => this.store.retag([d], data.add, data.remove));
  }

  async remove() {
    const d = this.doc()!;
    const a = await this.alertCtrl.create({
      header: `Remover "${d.title}"?`,
      message: 'O arquivo vai para a lixeira do Google Drive e pode ser recuperado por 30 dias.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    const ok = await this.busy('Removendo…', () => this.store.remove([d]));
    if (ok) await this.router.navigateByUrl('/', { replaceUrl: true });
  }

  private async busy(message: string, fn: () => Promise<unknown>): Promise<boolean> {
    const l = await this.loadingCtrl.create({ message });
    await l.present();
    try {
      await fn();
      return true;
    } catch (e) {
      const t = await this.toastCtrl.create({
        message: e instanceof Error ? e.message : String(e),
        color: 'danger',
        duration: 3000,
        position: 'top',
      });
      await t.present();
      return false;
    } finally {
      await l.dismiss();
    }
  }
}
