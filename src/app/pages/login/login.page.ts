import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [IonContent, IonButton, IonIcon, IonSpinner],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  busy = signal(false);
  error = signal<string | null>(null);

  async login() {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login();
      const next = this.route.snapshot.queryParamMap.get('next') ?? '/';
      await this.router.navigateByUrl(next, { replaceUrl: true });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Não foi possível entrar com o Google.');
    } finally {
      this.busy.set(false);
    }
  }
}
