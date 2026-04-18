import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { providerGuard } from './guards/provider.guard';
import { LoginPageComponent } from './pages/login-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { AdminPageComponent } from './pages/admin-page.component';
import { ProviderPageComponent } from './pages/provider-page.component';

import { MapComponent } from './components/map/map.component';

export const routes: Routes = [
	{ path: 'login', component: LoginPageComponent },
	{ path: 'dashboard', component: DashboardPageComponent, canActivate: [authGuard] },
	{ path: 'admin', component: AdminPageComponent, canActivate: [adminGuard] },
	{ path: 'provider', component: ProviderPageComponent, canActivate: [providerGuard] },
	{ path: 'map', component: MapComponent },
	{ path: '', pathMatch: 'full', redirectTo: 'map' },
	{ path: '**', redirectTo: 'map' },
];
