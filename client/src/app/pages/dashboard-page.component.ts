import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  template: `
    <section style="padding: 24px; max-width: 720px; margin: 0 auto;">
      <h1>Dashboard</h1>
      <p>Protected route. Requires authenticated user.</p>
    </section>
  `,
})
export class DashboardPageComponent {}
