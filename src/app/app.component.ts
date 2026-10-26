import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { AuthService } from './core/auth.service';
import { ShareInService } from './core/share-in.service';
import { registerIcons } from './icons';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  private shareIn = inject(ShareInService);

  constructor() {
    registerIcons();
  }

  async ngOnInit() {
    await this.shareIn.listen();
    await this.auth.init();
  }
}
