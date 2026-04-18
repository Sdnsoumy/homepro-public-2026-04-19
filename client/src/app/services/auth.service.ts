import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export type UserRole = 'user' | 'provider' | 'admin';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accessTokenKey = 'homepro_access_token';
  private readonly userKey = 'homepro_user';

  private get isBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.accessTokenKey);
  }

  setAccessToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.accessTokenKey, token);
  }

  setUser(user: AuthUser): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  getUser(): AuthUser | null {
    if (!this.isBrowser) return null;
    const rawUser = localStorage.getItem(this.userKey);
    if (!rawUser) return null;

    try {
      return JSON.parse(rawUser) as AuthUser;
    } catch {
      return null;
    }
  }

  getUserRole(): UserRole | null {
    return this.getUser()?.role ?? null;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  clearSession(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.userKey);
  }

  refreshAccessToken(): Observable<string> {
    return this.http
      .post<RefreshTokenResponse>('/api/auth/refresh', {}, { withCredentials: true })
      .pipe(map((response) => response.accessToken));
  }
}
