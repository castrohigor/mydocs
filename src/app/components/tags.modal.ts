import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonItem,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { DocsStore } from '../core/docs.store';
import { DocItem, tagKey } from '../core/models';
import { TagInputComponent } from './tag-input.component';

export interface RetagResult {
  add: string[];
  remove: string[];
}

/** Re-taguear um ou vários documentos de uma vez. */
@Component({
  selector: 'app-tags-modal',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonChip,
    IonLabel,
    IonIcon,
    TagInputComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-button (click)="cancel()">Cancelar</ion-button></ion-buttons>
        <ion-title>Tags</ion-title>
        <ion-buttons slot="end"><ion-button strong (click)="save()">Salvar</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p class="ion-padding-horizontal muted">
        {{ docs().length === 1 ? docs()[0].title : docs().length + ' documentos selecionados' }}
      </p>

      @if (current().length) {
        <ion-list inset>
          <ion-list-header>Tags atuais — toque para remover</ion-list-header>
          <ion-item lines="none">
            <div class="chips">
              @for (t of current(); track t) {
                <ion-chip class="tag-chip" [outline]="removed().has(key(t))" (click)="toggle(t)">
                  <ion-label [class.strike]="removed().has(key(t))">#{{ t }}</ion-label>
                  <ion-icon [name]="removed().has(key(t)) ? 'add' : 'close-circle'" />
                </ion-chip>
              }
            </div>
          </ion-item>
        </ion-list>
      }

      <ion-list inset>
        <ion-list-header>Adicionar tags</ion-list-header>
        <ion-item lines="none">
          <app-tag-input [(tags)]="added" [suggestions]="store.allTags()" />
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: `
    .chips { display: flex; flex-wrap: wrap; padding: 6px 0; }
    app-tag-input { width: 100%; padding: 6px 0; }
    .strike { text-decoration: line-through; opacity: .6; }
  `,
})
export class TagsModal implements OnInit {
  store = inject(DocsStore);
  private modal = inject(ModalController);

  docs = input.required<DocItem[]>();
  added = signal<string[]>([]);
  removed = signal(new Set<string>());

  current = signal<string[]>([]);
  key = tagKey;

  ngOnInit() {
    const seen = new Map<string, string>();
    this.docs().forEach((d) => d.tags.forEach((t) => seen.set(tagKey(t), seen.get(tagKey(t)) ?? t)));
    this.current.set([...seen.values()]);
  }

  toggle(t: string) {
    const k = tagKey(t);
    this.removed.update((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  save() {
    const remove = this.current().filter((t) => this.removed().has(tagKey(t)));
    void this.modal.dismiss({ add: this.added(), remove } satisfies RetagResult, 'save');
  }

  cancel() {
    void this.modal.dismiss(null, 'cancel');
  }
}
