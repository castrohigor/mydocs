import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonFooter,
  IonHeader,
  IonIcon,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { DocsStore } from '../../core/docs.store';
import { FilesService } from '../../core/files.service';
import { DocFolder, DocItem, tagKey } from '../../core/models';
import { ShareInService } from '../../core/share-in.service';
import { pickFolder } from '../../components/folder-picker.modal';
import { RetagResult, TagsModal } from '../../components/tags.modal';
import { WalletCardComponent } from '../../components/wallet-card.component';

interface Section {
  folder?: DocFolder;
  docs: DocItem[];
}

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonChip,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonFooter,
    IonSpinner,
    WalletCardComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  store = inject(DocsStore);
  private files = inject(FilesService);
  private shareIn = inject(ShareInService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  query = signal('');
  folderFilter = signal<string | null>(null);
  tagFilter = signal<string[]>([]);

  selecting = signal(false);
  selected = signal(new Set<string>());

  filtered = computed(() => {
    const q = tagKey(this.query());
    const folder = this.folderFilter();
    const tags = this.tagFilter().map(tagKey);
    return this.store.docs().filter((d) => {
      if (folder && d.folderId !== folder) return false;
      const docTags = d.tags.map(tagKey);
      if (tags.some((t) => !docTags.includes(t))) return false;
      if (q) {
        const folderName = this.store.folderById().get(d.folderId)?.name ?? '';
        const hay = tagKey([d.title, d.fileName, folderName, ...d.tags].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  /** Sem filtros: uma pilha por pasta. Com filtro: uma pilha só. */
  sections = computed<Section[]>(() => {
    const docs = this.filtered();
    const grouped = !this.folderFilter() && !this.query() && !this.tagFilter().length;
    if (!grouped) return docs.length ? [{ docs }] : [];
    const byFolder = new Map<string, DocItem[]>();
    docs.forEach((d) => byFolder.set(d.folderId, [...(byFolder.get(d.folderId) ?? []), d]));
    const sections: Section[] = this.store
      .folders()
      .filter((f) => byFolder.has(f.id))
      .map((f) => ({ folder: f, docs: byFolder.get(f.id)! }));
    const orphan = docs.filter((d) => !this.store.folderById().has(d.folderId));
    if (orphan.length) sections.push({ docs: orphan });
    return sections;
  });

  selectedDocs = computed(() => this.store.docs().filter((d) => this.selected().has(d.id)));

  private pressTimer?: ReturnType<typeof setTimeout>;
  private pressStart?: { x: number; y: number };
  private longPressed = false;

  ngOnInit() {
    void this.store.load();
  }

  async refresh(ev: CustomEvent) {
    await this.store.refresh();
    (ev.target as HTMLIonRefresherElement).complete();
  }

  // ---------- Filtros ----------

  toggleTag(tag: string) {
    const k = tagKey(tag);
    this.tagFilter.update((list) =>
      list.some((t) => tagKey(t) === k) ? list.filter((t) => tagKey(t) !== k) : [...list, tag],
    );
  }

  hasTag(tag: string) {
    return this.tagFilter().some((t) => tagKey(t) === tagKey(tag));
  }

  clearFilters() {
    this.query.set('');
    this.folderFilter.set(null);
    this.tagFilter.set([]);
  }

  /** Quantos px de cada cartão ficam visíveis na pilha. */
  peek(count: number) {
    if (this.selecting()) return 84;
    return count <= 2 ? 210 : 80;
  }

  // ---------- Toque / toque longo ----------

  pointerDown(ev: PointerEvent, doc: DocItem) {
    this.longPressed = false;
    this.pressStart = { x: ev.clientX, y: ev.clientY };
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.longPressed = true;
      void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
      this.selecting.set(true);
      this.toggle(doc.id, true);
    }, 450);
  }

  pointerMove(ev: PointerEvent) {
    if (!this.pressStart) return;
    if (Math.abs(ev.clientX - this.pressStart.x) > 10 || Math.abs(ev.clientY - this.pressStart.y) > 10) {
      clearTimeout(this.pressTimer);
    }
  }

  pointerUp() {
    clearTimeout(this.pressTimer);
    this.pressStart = undefined;
  }

  tap(doc: DocItem) {
    if (this.longPressed) {
      this.longPressed = false;
      return;
    }
    if (this.selecting()) this.toggle(doc.id);
    else void this.router.navigate(['/doc', doc.id]);
  }

  // ---------- Seleção ----------

  startSelecting() {
    this.selecting.set(true);
  }

  stopSelecting() {
    this.selecting.set(false);
    this.selected.set(new Set());
  }

  toggle(id: string, force?: boolean) {
    this.selected.update((s) => {
      const n = new Set(s);
      const on = force ?? !n.has(id);
      on ? n.add(id) : n.delete(id);
      return n;
    });
  }

  selectAll() {
    const all = this.filtered().map((d) => d.id);
    const allOn = all.every((id) => this.selected().has(id));
    this.selected.set(allOn ? new Set() : new Set(all));
  }

  // ---------- Ações em lote ----------

  async shareSelected() {
    await this.withLoading('Preparando arquivos…', () => this.files.shareFiles(this.selectedDocs()));
  }

  async moveSelected() {
    const folderId = await pickFolder(this.modalCtrl, { title: 'Mover para' });
    if (!folderId) return;
    const n = this.selectedDocs().length;
    await this.withLoading('Movendo…', () => this.store.move(this.selectedDocs(), folderId));
    this.stopSelecting();
    await this.toast(`${n} documento(s) movido(s).`);
  }

  async retagSelected() {
    const m = await this.modalCtrl.create({ component: TagsModal, componentProps: { docs: this.selectedDocs() } });
    await m.present();
    const { data, role } = await m.onWillDismiss<RetagResult>();
    if (role !== 'save' || !data || (!data.add.length && !data.remove.length)) return;
    await this.withLoading('Atualizando tags…', () => this.store.retag(this.selectedDocs(), data.add, data.remove));
    this.stopSelecting();
  }

  async deleteSelected() {
    const docs = this.selectedDocs();
    const a = await this.alertCtrl.create({
      header: `Remover ${docs.length} documento(s)?`,
      message: 'Eles vão para a lixeira do Google Drive e podem ser recuperados por 30 dias.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    await this.withLoading('Removendo…', () => this.store.remove(docs));
    this.stopSelecting();
  }

  // ---------- Adicionar pelo botão + ----------

  pickFiles(input: HTMLInputElement) {
    const list = Array.from(input.files ?? []);
    input.value = '';
    if (!list.length) return;
    this.shareIn.receive(
      list.map((f) => ({
        uri: URL.createObjectURL(f),
        name: f.name,
        mimeType: f.type || 'application/octet-stream',
        blob: f,
      })),
    );
  }

  private async withLoading(message: string, fn: () => Promise<unknown>) {
    const l = await this.loadingCtrl.create({ message });
    await l.present();
    try {
      await fn();
    } catch (e) {
      await this.toast(e instanceof Error ? e.message : String(e), 'danger');
    } finally {
      await l.dismiss();
    }
  }

  private async toast(message: string, color?: string) {
    const t = await this.toastCtrl.create({ message, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
