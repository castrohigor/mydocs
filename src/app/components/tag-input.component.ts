import { Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonChip, IonIcon, IonInput, IonLabel } from '@ionic/angular';
import { tagKey } from '../core/models';

/** Campo de tags com sugestões: digite e toque Enter (ou vírgula) para adicionar. */
@Component({
  selector: 'app-tag-input',
  imports: [FormsModule, IonInput, IonChip, IonLabel, IonIcon],
  template: `
    <div class="chips">
      @for (t of tags(); track t) {
        <ion-chip class="tag-chip" (click)="remove(t)">
          <ion-label>#{{ t }}</ion-label>
          <ion-icon name="close-circle" />
        </ion-chip>
      }
    </div>
    <ion-input
      [placeholder]="placeholder()"
      [ngModel]="text()"
      (ngModelChange)="onType($event)"
      (keydown.enter)="commit()"
      (ionBlur)="commit()"
      enterkeyhint="done"
      autocapitalize="words"
    >
      <ion-icon slot="start" name="pricetag-outline" aria-hidden="true" />
    </ion-input>
    @if (filtered().length) {
      <div class="chips suggestions">
        @for (s of filtered(); track s) {
          <ion-chip class="tag-chip" outline (click)="add(s)">
            <ion-icon name="add" />
            <ion-label>{{ s }}</ion-label>
          </ion-chip>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .chips { display: flex; flex-wrap: wrap; }
    .suggestions { margin-top: 6px; }
    ion-input ion-icon { margin-right: 8px; color: var(--ion-color-medium); }
  `,
})
export class TagInputComponent {
  tags = model<string[]>([]);
  suggestions = input<string[]>([]);
  placeholder = input('Adicionar tag (ex.: Higor, Comprovantes)');

  text = signal('');

  filtered = computed(() => {
    const q = tagKey(this.text());
    const have = new Set(this.tags().map(tagKey));
    return this.suggestions()
      .filter((s) => !have.has(tagKey(s)) && (!q || tagKey(s).includes(q)))
      .slice(0, 8);
  });

  onType(value: string | null | undefined) {
    const v = value ?? '';
    if (v.includes(',')) {
      v.split(',').slice(0, -1).forEach((p) => this.add(p));
      this.text.set(v.split(',').pop() ?? '');
    } else {
      this.text.set(v);
    }
  }

  commit() {
    if (this.text().trim()) this.add(this.text());
  }

  add(raw: string) {
    const tag = raw.trim().replace(/^#/, '');
    this.text.set('');
    if (!tag) return;
    if (this.tags().some((t) => tagKey(t) === tagKey(tag))) return;
    this.tags.update((list) => [...list, tag]);
  }

  remove(tag: string) {
    this.tags.update((list) => list.filter((t) => t !== tag));
  }
}
