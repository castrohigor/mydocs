import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },
      { path: 'import', loadComponent: () => import('./pages/import/import.page').then((m) => m.ImportPage) },
      { path: 'doc/:id', loadComponent: () => import('./pages/document/document.page').then((m) => m.DocumentPage) },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
