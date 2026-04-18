import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  template: `
    <section style="padding: 24px; max-width: 720px; margin: 0 auto;">
      <h1>Admin</h1>
      <p>Protected route. Requires admin role.</p>
    </section>
  `,
})
export class AdminPageComponent {}
