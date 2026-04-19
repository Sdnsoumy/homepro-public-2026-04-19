import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Socket.io wrapper service for real-time communication with backend.
 * Handles connection/disconnection lifecycle and provides Observable-based event listening.
 * 
 * Flow:
 * 1. Login flow: auth.service calls socketService.connect(token) → sends token in auth handshake
 * 2. Backend validates token in socket middleware → attaches user to socket
 * 3. Components subscribe to events like socket.on('new_booking') via Observable
 * 4. On logout: auth.service calls socketService.disconnect()
 */
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket;
  private connected = false;

  /**
   * Initiates Socket.io connection with JWT token.
   * Token is sent to backend's socket auth middleware for validation.
   * @param token - JWT access token from localStorage
   */
  connect(token: string): void {
    if (this.connected) return; // Prevent duplicate connections

    // Create socket with auth token and reconnection config
    this.socket = io(environment.socketUrl, {
      auth: { token }, // Sent to socket auth middleware on backend
      transports: ['websocket'], // Use WebSocket only (skip long-polling for performance)
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      // If token expired, do not keep retrying.
      if (err.message === 'Token invalid or expired') {
        this.socket.disconnect();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connected = false;
    });
  }

  // Generic method to listen to any event.
  on<T>(event: string): Observable<T> {
    return new Observable((observer) => {
      this.socket.on(event, (data: T) => observer.next(data));
    });
  }

  // Emit an event to the server.
  emit(event: string, data: any): void {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
