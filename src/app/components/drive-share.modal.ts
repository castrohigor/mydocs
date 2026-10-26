import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
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
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { DocsStore } from '../core/docs.store';
import { DriveService } from '../core/drive.service';
import { FilesService } from '../core/files.service';
import { DocItem, DrivePermission } from '../core/models';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  writer: 'Editor',
  commenter: 'Comentarista',
  reader: 'Leitor',
};

/** Compartilhar como no Google Drive: convidar pessoas por e-mail ou gerar link. */
@Component({
  selector: 'app-drive-share',
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
    IonSegment,
    IonSegmentButton,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Compartilhar no Drive</ion-title>
        <ion-buttons slot="end"><ion-button (click)="close()">Concluir</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p class="ion-padding-horizontal muted">{{ doc().title }}</p>

      <ion-list inset>
        <ion-list-header>Adicionar pessoa</ion-list-header>
        <ion-item>
          <ion-icon slot="start" name="person-add-outline" />
          <ion-input type="email" inputmode="email" placeholder="email@exemplo.com" [(ngModel)]="email" />
        </ion-item>
        <ion-item>
          <ion-segment [value]="role()" (ionChange)="role.set($any($event.detail.value))">
            <ion-segment-button value="reader"><ion-label>Leitor</ion-label></ion-segment-button>
            <ion-segment-button value="writer"><ion-label>Editor</ion-label></ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item lines="none">
          <ion-button expand="block" class="full" (click)="invite()" [disabled]="!validEmail() || busy()">
            Enviar convite
          </ion-button>
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-list-header>Acesso geral</ion-list-header>
        @if (linkPermission(); as p) {
          <ion-item>
            <ion-icon slot="start" name="globe-outline" color="success" />
            <ion-label>
              Qualquer pessoa com o link
              <p>pode visualizar</p>
            </ion-label>
            <ion-button slot="end" fill="clear" color="danger" (click)="revoke(p)">Restringir</ion-button>
          </ion-item>
          <ion-item button detail="false" (click)="sendLink()">
            <ion-icon slot="start" name="share-social-outline" />
            <ion-label>Enviar link</ion-label>
          </ion-item>
        } @else {
          <ion-item>
            <ion-icon slot="start" name="link-outline" />
            <ion-label>
              Restrito
              <p>só as pessoas adicionadas podem abrir</p>
            </ion-label>
            <ion-button slot="end" fill="clear" (click)="enableLink()" [disabled]="busy()">Criar link</ion-button>
          </ion-item>
        }
      </ion-list>

      <ion-list inset>
        <ion-list-header>Pessoas com acesso</ion-list-header>
        @if (loading()) {
          <ion-item lines="none"><ion-spinner name="crescent" /></ion-item>
        }
        @for (p of people(); track p.id) {
          <ion-item>
            <ion-label>
              {{ p.displayName || p.emailAddress }}
              <p>{{ p.emailAddress }}</p>
            </ion-label>
            @if (p.role === 'owner') {
              <ion-note slot="end">{{ roleLabel[p.role] }}</ion-note>
            } @else {
              <ion-button slot="end" fill="clear" color="danger" (click)="revoke(p)">
                {{ roleLabel[p.role] }} · Remover
              </ion-button>
            }
          </ion-item>
        }
      </ion-list>
    </ion-content>
  `,
  styles: `.full { width: 100%; }`,
})
export class DriveShareModal implements OnInit {
  private drive = inject(DriveService);
  private files = inject(FilesService);
  private store = inject(DocsStore);
  private modal = inject(ModalController);
  private toast = inject(ToastController);
  private alert = inject(AlertController);

  doc = input.required<DocItem>();

  permissions = signal<DrivePermission[]>([]);
  loading = signal(true);
  busy = signal(false);
  role = signal<'reader' | 'writer'>('reader');
  email = '';
  roleLabel = ROLE_LABEL;

  people = computed(() => this.permissions().filter((p) => p.type === 'user' || p.type === 'group'));
  linkPermission = computed(() => this.permissions().find((p) => p.type === 'anyone'));

  validEmail = () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email.trim());

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    this.loading.set(true);
    try {
      this.permissions.set(await this.drive.listPermissions(this.doc().id));
    } catch (e) {
      await this.show(this.msg(e));
    } finally {
      this.loading.set(false);
    }
  }

  async invite() {
    await this.run(async () => {
      await this.drive.shareWithEmail(this.doc().id, this.email.trim(), this.role());
      this.email = '';
      this.store.markShared(this.doc().id);
      await this.show('Convite enviado.');
    });
  }

  async enableLink() {
    await this.run(async () => {
      const link = await this.drive.enableLinkSharing(this.doc().id);
      this.store.markShared(this.doc().id);
      await this.files.shareText(link, this.doc().title);
    });
  }

  async sendLink() {
    await this.run(async () => {
      const link = await this.drive.enableLinkSharing(this.doc().id);
      await this.files.shareText(link, this.doc().title);
    });
  }

  async revoke(p: DrivePermission) {
    const a = await this.alert.create({
      header: p.type === 'anyone' ? 'Desativar o link?' : 'Remover acesso?',
      message: p.type === 'anyone' ? 'Quem tem o link não conseguirá mais abrir.' : p.emailAddress,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    await this.run(() => this.drive.removePermission(this.doc().id, p.id));
  }

  private async run(fn: () => Promise<unknown>) {
    this.busy.set(true);
    try {
      await fn();
      await this.reload();
    } catch (e) {
      await this.show(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }

  private msg(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }

  private async show(message: string) {
    const t = await this.toast.create({ message, duration: 2500, position: 'top' });
    await t.present();
  }

  close() {
    void this.modal.dismiss();
  }
}
