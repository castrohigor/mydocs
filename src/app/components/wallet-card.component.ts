import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { DocFolder, DocItem, KIND_ICON, KIND_LABEL, kindOf } from '../core/models';

/** Um "cartão" da carteira, no estilo do app Carteira. */
@Component({
  selector: 'app-wallet-card',
  imports: [IonIcon, DatePipe],
  template: `
    <div class="card" [style.--c]="color()" [style.--shade]="shade() + '%'" [class.selected]="selected()">
      <div class="top">
        <div class="kind">
          <ion-icon [name]="icon()" /> {{ label() }}
          <span class="sep">·</span>
          <span class="folder">{{ folder()?.name ?? 'Sem pasta' }}</span>
        </div>
        @if (selecting()) {
          <ion-icon class="check" [name]="selected() ? 'checkmark-circle' : 'ellipse-outline'" />
        } @else if (doc().shared) {
          <ion-icon class="check" name="people-outline" />
        }
      </div>
      <div class="title">{{ doc().title }}</div>
      <div class="bottom">
        <div class="tags">
          @for (t of doc().tags.slice(0, 3); track t) {
            <span class="tag">#{{ t }}</span>
          }
          @if (doc().tags.length > 3) {
            <span class="tag">+{{ doc().tags.length - 3 }}</span>
          }
        </div>
        <div class="date">{{ doc().modifiedTime | date: 'dd/MM/yy' }}</div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .card {
      --c: #2563eb;
      --shade: 0%;
      position: relative;
      height: 200px;
      border-radius: 18px;
      padding: 16px 18px;
      color: #fff;
      background:
        radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,.22), transparent 55%),
        linear-gradient(145deg,
          color-mix(in srgb, color-mix(in srgb, var(--c), #000 var(--shade)) 82%, #fff),
          color-mix(in srgb, color-mix(in srgb, var(--c), #000 var(--shade)) 78%, #000));
      box-shadow: 0 -2px 10px rgba(0,0,0,.10), 0 10px 22px rgba(0,0,0,.18);
      display: flex;
      flex-direction: column;
      transition: transform .18s ease, box-shadow .18s;
      overflow: hidden;
    }
    .card.selected {
      box-shadow: inset 0 0 0 3px rgba(255,255,255,.95), 0 -2px 10px rgba(0,0,0,.10), 0 10px 22px rgba(0,0,0,.18);
    }
    .top { display: flex; justify-content: space-between; align-items: center; height: 22px; }
    .kind {
      font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
      opacity: .9; display: flex; align-items: center; gap: 6px;
    }
    .check { font-size: 24px; }
    .title {
      margin-top: 8px; font-size: 21px; font-weight: 750; line-height: 1.15;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sep { opacity: .6; }
    .folder { font-weight: 600; letter-spacing: .04em; opacity: .85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kind { min-width: 0; }
    .bottom { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; }
    .tags { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
    .tag {
      font-size: 12px; background: rgba(255,255,255,.2); padding: 3px 8px; border-radius: 999px;
      white-space: nowrap;
    }
    .date { font-size: 12px; opacity: .85; flex-shrink: 0; }
  `,
})
export class WalletCardComponent {
  doc = input.required<DocItem>();
  folder = input<DocFolder | undefined>();
  selecting = input(false);
  selected = input(false);
  /** Escurece levemente o cartão (0–20) para diferenciar cartões da mesma pasta. */
  shade = input(0);

  color = computed(() => this.folder()?.color ?? '#64748b');
  private kind = computed(() => kindOf(this.doc().mimeType, this.doc().fileName));
  icon = computed(() => KIND_ICON[this.kind()]);
  label = computed(() => KIND_LABEL[this.kind()]);
}
