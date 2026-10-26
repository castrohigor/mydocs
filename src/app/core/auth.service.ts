import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../environments/environment';

/**
 * drive.file: o app só enxerga os arquivos que ele mesmo criou no Drive.
 * É um escopo "não sensível" — não exige verificação do Google para publicar.
 */
const SCOPES = ['email', 'profile', 'https://www.googleapis.com/auth/drive.file'];
const PROFILE_KEY = 'mydocs.profile';

export interface UserProfile {
  email: string;
  name: string;
  imageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private token = signal<string | null>(null);
  private tokenExpiresAt = 0;
  private initialized?: Promise<void>;

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoggedIn = computed(() => !!this.profile());

  init(): Promise<void> {
    this.initialized ??= (async () => {
      await SocialLogin.initialize({
        google: {
          webClientId: environment.google.webClientId,
          iOSClientId: environment.google.iOSClientId,
          mode: 'online',
        },
      });
      const saved = await Preferences.get({ key: PROFILE_KEY });
      if (saved.value) this.profile.set(JSON.parse(saved.value));
    })();
    return this.initialized;
  }

  async login(): Promise<void> {
    await this.init();
    const res = await SocialLogin.login({
      provider: 'google',
      options: { scopes: SCOPES, forceRefreshToken: Capacitor.getPlatform() === 'android' },
    });
    const result = res.result as {
      accessToken: { token: string; expires?: string } | null;
      profile: { email: string | null; name: string | null; imageUrl: string | null };
    };
    if (!result.accessToken?.token) {
      throw new Error('O Google não devolveu permissão de acesso ao Drive. Tente entrar novamente.');
    }
    this.setToken(result.accessToken.token, result.accessToken.expires);
    const profile: UserProfile = {
      email: result.profile.email ?? '',
      name: result.profile.name ?? result.profile.email ?? '',
      imageUrl: result.profile.imageUrl ?? undefined,
    };
    this.profile.set(profile);
    await Preferences.set({ key: PROFILE_KEY, value: JSON.stringify(profile) });
  }

  async logout(): Promise<void> {
    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch {
      /* já estava deslogado */
    }
    this.token.set(null);
    this.profile.set(null);
    await Preferences.remove({ key: PROFILE_KEY });
  }

  /** Devolve um access token válido, renovando-o silenciosamente quando expira. */
  async getAccessToken(forceRefresh = false): Promise<string> {
    await this.init();
    const valid = this.token() && Date.now() < this.tokenExpiresAt - 60_000;
    if (valid && !forceRefresh) return this.token()!;

    try {
      const { isLoggedIn } = await SocialLogin.isLoggedIn({ provider: 'google' });
      if (isLoggedIn) {
        const code = await SocialLogin.getAuthorizationCode({ provider: 'google' });
        if (code.accessToken) {
          this.setToken(code.accessToken);
          return code.accessToken;
        }
      }
    } catch {
      /* cai para o login interativo abaixo */
    }
    await this.login();
    return this.token()!;
  }

  private setToken(token: string, expires?: string) {
    this.token.set(token);
    const parsed = expires ? Date.parse(expires) : NaN;
    // Tokens do Google duram ~1h; sem data informada assumimos 50 min.
    this.tokenExpiresAt = Number.isFinite(parsed) ? parsed : Date.now() + 50 * 60_000;
  }
}
