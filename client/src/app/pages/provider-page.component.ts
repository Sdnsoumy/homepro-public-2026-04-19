import { Component } from '@angular/core';

@Component({
  selector: 'app-provider-page',
  standalone: true,
  template: `
    <section style="padding: 24px; max-width: 720px; margin: 0 auto;">
      <h1>Provider</h1>
      <p>Protected route. Requires provider role.</p>
    </section>
  `,
})
export class ProviderPageComponent {}
