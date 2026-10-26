import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonAvatar,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { DocsStore } from '../../core/docs.store';
import { FilesService } from '../../core/files.service';
import { DocFolder, FOLDER_COLORS } from '../../core/models';
import { pickFolder } from '../../components/folder-picker.modal';

@Component({
  selector: 'app-settings',
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonAvatar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="Carteira" /></ion-buttons>
        <ion-title>Ajustes</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (auth.profile(); as p) {
        <ion-list inset>
          <ion-item>
            @if (p.imageUrl) {
              <ion-avatar slot="start"><img [src]="p.imageUrl" alt="" referrerpolicy="no-referrer" /></ion-avatar>
            }
            <ion-label>
              {{ p.name }}
              <p>{{ p.email }}</p>
            </ion-label>
          </ion-item>
          <ion-item button detail="false" (click)="store.refresh()">
            <ion-icon slot="start" name="refresh-outline" />
            <ion-label>Sincronizar agora</ion-label>
            @if (store.lastSync(); as t) {
              <ion-note slot="end">{{ t | date: 'dd/MM HH:mm' }}</ion-note>
            }
          </ion-item>
        </ion-list>
      }

      <ion-list inset>
        <ion-list-header>Pastas</ion-list-header>
        @for (f of store.folders(); track f.id) {
          <ion-item button (click)="editFolder(f)">
            <span slot="start" class="dot" [style.background]="f.color"></span>
            <ion-label>{{ f.name }}</ion-label>
            <ion-note slot="end">{{ counts().get(f.id) ?? 0 }}</ion-note>
          </ion-item>
        }
        <ion-item button detail="false" (click)="newFolder()">
          <ion-icon slot="start" name="add-circle-outline" color="primary" />
          <ion-label color="primary">Nova pasta</ion-label>
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-item button detail="false" (click)="clearCache()">
          <ion-icon slot="start" name="trash-outline" />
          <ion-label>Limpar arquivos baixados neste aparelho</ion-label>
        </ion-item>
        <ion-item button detail="false" (click)="logout()">
          <ion-icon slot="start" name="log-out-outline" color="danger" />
          <ion-label color="danger">Sair da conta Google</ion-label>
        </ion-item>
      </ion-list>

      <p class="ion-padding-horizontal muted foot">
        Seus documentos ficam na pasta <b>MyDocs</b> do seu Google Drive. Sair não apaga nada.
      </p>
    </ion-content>
  `,
  styles: `
    .dot { width: 16px; height: 16px; border-radius: 4px; }
    .foot { font-size: 13px; text-align: center; }
  `,
})
export class SettingsPage {
  auth = inject(AuthService);
  store = inject(DocsStore);
  private files = inject(FilesService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private sheetCtrl = inject(ActionSheetController);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  counts = computed(() => {
    const m = new Map<string, number>();
    this.store.docs().forEach((d) => m.set(d.folderId, (m.get(d.folderId) ?? 0) + 1));
    return m;
  });

  async newFolder() {
    await pickFolder(this.modalCtrl, { title: 'Nova pasta' });
  }

  async editFolder(f: DocFolder) {
    const sheet = await this.sheetCtrl.create({
      header: f.name,
      buttons: [
        { text: 'Renomear', data: 'rename' },
        { text: 'Mudar cor', data: 'color' },
        { text: 'Remover pasta', role: 'destructive', data: 'delete' },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss();
    try {
      if (data === 'rename') await this.renameFolder(f);
      if (data === 'color') await this.recolorFolder(f);
      if (data === 'delete') await this.deleteFolder(f);
    } catch (e) {
      await this.toast(e instanceof Error ? e.message : String(e));
    }
  }

  private async renameFolder(f: DocFolder) {
    const a = await this.alertCtrl.create({
      header: 'Renomear pasta',
      inputs: [{ name: 'name', value: f.name }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Salvar', role: 'confirm' },
      ],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss<{ values: { name: string } }>();
    const name = data?.values?.name?.trim();
    if (role === 'confirm' && name && name !== f.name) await this.store.updateFolder(f.id, { name });
  }

  private async recolorFolder(f: DocFolder) {
    const a = await this.alertCtrl.create({
      header: 'Cor da pasta',
      inputs: FOLDER_COLORS.map((c, i) => ({
        type: 'radio' as const,
        label: ['Azul', 'Âmbar', 'Verde', 'Vermelho', 'Roxo', 'Rosa', 'Céu', 'Ardósia'][i],
        value: c,
        checked: c === f.color,
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'OK', role: 'confirm' },
      ],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss<{ values: string }>();
    if (role === 'confirm' && data?.values) await this.store.updateFolder(f.id, { color: data.values });
  }

  private async deleteFolder(f: DocFolder) {
    const n = this.counts().get(f.id) ?? 0;
    const a = await this.alertCtrl.create({
      header: `Remover "${f.name}"?`,
      message: n
        ? `A pasta e seus ${n} documento(s) vão para a lixeira do Google Drive.`
        : 'A pasta vai para a lixeira do Google Drive.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role === 'destructive') await this.store.deleteFolder(f.id);
  }

  async clearCache() {
    await this.files.clearCache();
    await this.toast('Arquivos baixados removidos deste aparelho.');
  }

  async logout() {
    await this.auth.logout();
    this.store.clear();
    await this.files.clearCache();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, position: 'top' });
    await t.present();
  }
}
