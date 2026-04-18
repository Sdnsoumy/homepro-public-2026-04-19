import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section style="padding: 24px; max-width: 720px; margin: 0 auto;">
      <h1>Login</h1>
      <p>Please sign in to continue.</p>
      <p style="margin-top: 16px;">
        Demo links:
        <a routerLink="/dashboard">Dashboard</a> |
        <a routerLink="/provider">Provider</a> |
        <a routerLink="/admin">Admin</a>
      </p>
    </section>
  `,
})
export class LoginPageComponent {}
