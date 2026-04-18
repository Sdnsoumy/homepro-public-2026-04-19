import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

let refreshRequest$: Observable<string> | null = null;

const withAuth = (req: HttpRequest<unknown>, token?: string): HttpRequest<unknown> => {
  if (!token) {
    return req.clone({ withCredentials: true });
  }

  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
    withCredentials: true,
  });
};

const redirectToLogin = (router: Router): void => {
  void router.navigate(['/login']);
};

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isRefreshRequest = req.url.includes('/api/auth/refresh');
  const accessToken = authService.getAccessToken();
  const request = isRefreshRequest ? req.clone({ withCredentials: true }) : withAuth(req, accessToken ?? undefined);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      if (isRefreshRequest) {
        authService.clearSession();
        redirectToLogin(router);
        return throwError(() => error);
      }

      if (!accessToken) {
        authService.clearSession();
        redirectToLogin(router);
        return throwError(() => error);
      }

      if (!refreshRequest$) {
        refreshRequest$ = authService.refreshAccessToken().pipe(
          tap((newToken) => authService.setAccessToken(newToken)),
          shareReplay(1),
          finalize(() => {
            refreshRequest$ = null;
          })
        );
      }

      return refreshRequest$.pipe(
        switchMap((newToken) => next(withAuth(req, newToken))),
        catchError((refreshError) => {
          authService.clearSession();
          redirectToLogin(router);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
