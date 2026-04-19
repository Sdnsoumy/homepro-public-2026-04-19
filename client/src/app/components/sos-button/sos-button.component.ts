/**
 * SOS Emergency Button Component
 * 
 * Triggers emergency alert by:
 * 1. Requesting user's current GPS location
 * 2. Sending SOS request to nearest providers
 * 3. Listening for provider acceptance via Socket.io
 * 4. Displaying provider name when someone accepts
 * 
 * Socket.io Events:
 * - sos_accepted: Provider accepted emergency request
 * - sos_no_providers: No providers responded after Wave 1 & Wave 2 timeouts
 */

import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../services/socket.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-sos-button',
  standalone: true,
  template: `
    <div class="sos-container">

      <button class="sos-btn"
        [disabled]="sosActive"
        (click)="triggerSOS()">
        {{ sosActive ? 'Finding Help...' : 'SOS Emergency' }}
      </button>

      <div class="sos-status" *ngIf="statusMessage">
        {{ statusMessage }}
      </div>

      <div class="sos-accepted" *ngIf="acceptedProvider">
        {{ acceptedProvider }} is on the way!
      </div>

    </div>
  `,
  styles: [`
    .sos-container {
      padding: 16px;
      text-align: center;
    }

    .sos-btn {
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      background: #dc2626;
      color: white;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .sos-btn:hover:not(:disabled) {
      background: #b91c1c;
      transform: scale(1.05);
    }

    .sos-btn:disabled {
      background: #7c2d12;
      cursor: not-allowed;
      opacity: 0.8;
    }

    .sos-status {
      margin-top: 12px;
      padding: 8px;
      border-radius: 6px;
      background: #fef3c7;
      color: #92400e;
      font-size: 14px;
    }

    .sos-accepted {
      margin-top: 12px;
      padding: 8px;
      border-radius: 6px;
      background: #dbeafe;
      color: #0c4a6e;
      font-size: 14px;
      font-weight: 600;
    }
  `]
})
export class SosButtonComponent {
  sosActive        = false;
  statusMessage    = '';
  acceptedProvider = '';

  constructor(
    private http: HttpClient,
    private socketService: SocketService,
  ) {
    this.listenForSOSEvents();
  }

  /**
   * Trigger SOS emergency alert
   * 
   * Flow:
   * 1. Request GPS location from user (high accuracy, 5s timeout)
   * 2. Send SOS to backend with lat/lng/category
   * 3. Backend dispatches to nearest 3 providers (Wave 1)
   * 4. Listen for sos_accepted or sos_no_providers socket events
   */
  triggerSOS(): void {
    if (!navigator.geolocation) {
      this.statusMessage = 'GPS not available. Cannot trigger SOS.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.sendSOS(latitude, longitude);
      },
      () => {
        this.statusMessage = 'Location access required for SOS. Please enable GPS.';
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  /**
   * Send SOS request to backend API
   * @param lat - User's current latitude
   * @param lng - User's current longitude
   */
  private sendSOS(lat: number, lng: number): void {
    this.sosActive     = true;
    this.statusMessage = 'Alerting nearest providers — Wave 1...';

    // In production: Let user select category before triggering
    // For now: Default to Electrician as placeholder
    this.http.post(`${environment.apiUrl}/sos`, {
      lat,
      lng,
      category: 'Electrician', // TODO: User should select this before SOS
      address:  'Current location',
    }).subscribe({
      next: (res: any) => {
        // SOS sent successfully, waiting for provider response
        // Socket events will update UI
      },
      error: () => {
        this.sosActive     = false;
        this.statusMessage = 'SOS failed. Please try again.';
      }
    });
  }

  /**
   * Listen for real-time SOS response events via Socket.io
   * 
   * Events:
   * - sos_accepted: Provider accepted and is en route
   * - sos_no_providers: Wave 1 & Wave 2 both timed out, no providers
   */
  private listenForSOSEvents(): void {
    // Provider accepted the SOS emergency request
    this.socketService.on<any>('sos_accepted').subscribe(data => {
      this.sosActive       = false;
      this.acceptedProvider = data.providerName;
      this.statusMessage   = ''; // Clear status, show accepted instead
    });

    // No providers responded to both Wave 1 and Wave 2
    // User should call emergency services
    this.socketService.on<any>('sos_no_providers').subscribe(data => {
      this.sosActive     = false;
      this.statusMessage = data.message;
    });
  }
}
