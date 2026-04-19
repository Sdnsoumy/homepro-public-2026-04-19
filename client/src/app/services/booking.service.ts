import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Booking Service: HTTP API wrapper for booking operations
 * 
 * All booking status changes go through this service.
 * Backend validates requests with auth guards and emits Socket.io notifications.
 * 
 * Booking Lifecycle:
 * 1. User creates booking → POST /bookings → status='Requested', starts 5-min countdown
 * 2. Provider accepts within 5min → PATCH /bookings/:id/status={status:'Accepted'}
 * 3. Provider marks in-progress → PATCH /bookings/:id/status={status:'In-Progress'}
 * 4. Provider marks complete → PATCH /bookings/:id/status={status:'Completed'}
 * 5. Or provider rejects → PATCH /bookings/:id/status={status:'Rejected', cancelReason}
 * 6. Auto-reject: System auto-rejects after 5 min if provider doesn't respond
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Create a new booking request
   * @param data - { providerId, service, scheduledAt, address, notes?, isEmergency? }
   * @returns Observable<{ success: boolean, data: Booking }>
   */
  createBooking(data: any) {
    return this.http.post(`${this.apiUrl}/bookings`, data);
  }

  /**
   * Update booking status (Accept, Reject, In-Progress, Completed, Cancel)
   * @param bookingId - Booking _id
   * @param status - Target status (Accepted|Rejected|In-Progress|Completed|Cancelled)
   * @param cancelReason - Optional reason if status is Cancelled
   * @returns Observable<{ success: boolean, data: Booking }>
   */
  updateStatus(bookingId: string, status: string, cancelReason?: string) {
    return this.http.patch(`${this.apiUrl}/bookings/${bookingId}/status`, {
      status,
      cancelReason,
    });
  }

  /**
   * Get all bookings created by authenticated user
   * @returns Observable<{ success: boolean, data: Booking[] }>
   */
  getMyBookings() {
    return this.http.get(`${this.apiUrl}/bookings/my`);
  }

  /**
   * Get all bookings assigned to authenticated provider
   * @returns Observable<{ success: boolean, data: Booking[] }>
   */
  getProviderBookings() {
    return this.http.get(`${this.apiUrl}/bookings/provider`);
  }
}
