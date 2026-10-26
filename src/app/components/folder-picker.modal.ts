import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { DocsStore } from '../core/docs.store';
import { FOLDER_COLORS } from '../core/models';

/** Escolher uma pasta existente ou criar uma nova. Fecha devolvendo o id da pasta. */
@Component({
  selector: 'app-folder-picker',
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
    IonIcon,
    IonInput,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-button (click)="close()">Cancelar</ion-button></ion-buttons>
        <ion-title>{{ title() }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-list-header>Nova pasta</ion-list-header>
        <ion-item>
          <ion-input
            placeholder="Nome da pasta (ex.: Pessoais)"
            [(ngModel)]="newName"
            (keydown.enter)="create()"
            autocapitalize="sentences"
          />
          <ion-button slot="end" fill="clear" (click)="create()" [disabled]="!newName.trim() || busy()">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Criar }
          </ion-button>
        </ion-item>
        <ion-item lines="none">
          <div class="colors">
            @for (c of colors; track c) {
              <button
                type="button"
                class="swatch"
                [style.background]="c"
                [class.on]="c === color()"
                (click)="color.set(c)"
                [attr.aria-label]="'Cor ' + c"
              ></button>
            }
          </div>
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-list-header>Pastas</ion-list-header>
        @for (f of store.folders(); track f.id) {
          <ion-item button detail="false" (click)="pick(f.id)">
            <span class="dot" slot="start" [style.background]="f.color"></span>
            <ion-label>{{ f.name }}</ion-label>
            @if (f.id === current()) {
              <ion-icon slot="end" name="checkmark" color="primary" />
            }
          </ion-item>
        } @empty {
          <ion-item lines="none"><ion-label class="muted">Nenhuma pasta ainda. Crie a primeira acima.</ion-label></ion-item>
        }
      </ion-list>
    </ion-content>
  `,
  styles: `
    .dot { width: 14px; height: 14px; border-radius: 4px; }
    .colors { display: flex; gap: 10px; flex-wrap: wrap; padding: 6px 0 10px; }
    .swatch { width: 28px; height: 28px; border-radius: 50%; border: 0; padding: 0; outline: 2px solid transparent; outline-offset: 2px; }
    .swatch.on { outline-color: var(--ion-text-color); }
  `,
})
export class FolderPickerModal {
  store = inject(DocsStore);
  private modal = inject(ModalController);

  title = input('Escolher pasta');
  current = input<string | undefined>();

  colors = FOLDER_COLORS;
  color = signal(FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]);
  newName = '';
  busy = signal(false);

  pick(id: string) {
    void this.modal.dismiss(id, 'picked');
  }

  async create() {
    if (!this.newName.trim()) return;
    this.busy.set(true);
    try {
      const folder = await this.store.createFolder(this.newName, this.color());
      this.pick(folder.id);
    } finally {
      this.busy.set(false);
    }
  }

  close() {
    void this.modal.dismiss(null, 'cancel');
  }
}

/** Atalho para abrir o seletor e aguardar a pasta escolhida. */
export async function pickFolder(
  modalCtrl: ModalController,
  opts: { title?: string; current?: string } = {},
): Promise<string | null> {
  const m = await modalCtrl.create({
    component: FolderPickerModal,
    componentProps: opts,
    breakpoints: [0, 0.75, 1],
    initialBreakpoint: 0.75,
    cssClass: 'sheet-modal',
  });
  await m.present();
  const { data, role } = await m.onWillDismiss<string>();
  return role === 'picked' ? (data ?? null) : null;
}
