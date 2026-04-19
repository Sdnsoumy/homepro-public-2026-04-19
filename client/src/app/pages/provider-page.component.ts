import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { SocketService } from '../services/socket.service';
import { BookingService } from '../services/booking.service';

/**
 * Provider Dashboard Component - Real-time booking notification interface
 * 
 * Socket.io Integration:
 * - Listens to 'new_booking' events from server (when user creates booking)
 * - Displays booking with 5-minute countdown timer
 * - Listens to 'booking_expired' when auto-reject happens
 * 
 * Workflow:
 * 1. User creates booking → Server emits 'new_booking' to provider's socket room
 * 2. Provider sees incoming booking card with countdown (300s → 0s)
 * 3. Provider clicks Accept/Reject → HTTP PATCH /bookings/:id/status
 * 4. Backend emits 'booking_accepted'/'booking_rejected' back to user
 * 5. If countdown reaches 0 → Server auto-rejects and emits 'booking_expired'
 * 6. Component clears UI and refreshes booking list
 */
@Component({
  selector: 'app-provider-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section style="padding: 24px; max-width: 980px; margin: 0 auto;">
      <h1>Provider Dashboard</h1>

      <article *ngIf="incomingBooking" style="margin: 16px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff7ed;">
        <h2 style="margin: 0 0 8px 0;">New Booking Request</h2>
        <p style="margin: 4px 0;"><strong>Service:</strong> {{ incomingBooking?.service || 'N/A' }}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> {{ incomingBooking?.address || 'N/A' }}</p>
        <p style="margin: 4px 0;"><strong>Time Remaining:</strong> {{ timeRemaining }}s</p>
        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <button
            (click)="acceptBooking(incomingBooking?._id)"
            style="padding: 10px 14px; border-radius: 8px; border: 0; background: #16a34a; color: #fff; cursor: pointer;"
          >
            Accept
          </button>
          <button
            (click)="rejectBooking(incomingBooking?._id)"
            style="padding: 10px 14px; border-radius: 8px; border: 0; background: #dc2626; color: #fff; cursor: pointer;"
          >
            Reject
          </button>
        </div>
      </article>

      <section style="margin-top: 20px;">
        <h2 style="margin-bottom: 10px;">My Bookings</h2>
        <div *ngIf="bookings.length === 0" style="padding: 14px; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b;">
          No bookings yet.
        </div>

        <article
          *ngFor="let booking of bookings"
          style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px;"
        >
          <p style="margin: 4px 0;"><strong>Service:</strong> {{ booking?.service || 'N/A' }}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> {{ booking?.status || 'N/A' }}</p>
          <p style="margin: 4px 0;"><strong>Scheduled:</strong> {{ booking?.scheduledAt | date:'medium' }}</p>

          <div style="display: flex; gap: 8px; margin-top: 8px;" *ngIf="booking?.status === 'Accepted'">
            <button
              (click)="updateStatus(booking._id, 'In-Progress')"
              style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer;"
            >
              Mark In-Progress
            </button>
            <button
              (click)="updateStatus(booking._id, 'Completed')"
              style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer;"
            >
              Mark Completed
            </button>
          </div>
        </article>
      </section>
    </section>
  `,
})
export class ProviderPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  incomingBooking: any = null;
  timeRemaining = 300;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  bookings: any[] = [];

  constructor(
    private socketService: SocketService,
    private bookingService: BookingService,
  ) {}

  ngOnInit(): void {
    // Initialize dashboard: load past bookings and set up real-time listeners
    this.loadMyBookings();
    this.listenForNewBookings(); // Subscribe to incoming booking socket events
    this.listenForExpiredBookings(); // Subscribe to auto-reject timeout events
  }

  /**
   * Subscribes to 'new_booking' socket events from server.
   * When a user creates a booking, server emits to this provider's room.
   * Stores booking and starts 5-minute countdown timer.
   */
  private listenForNewBookings(): void {
    this.socketService.on<any>('new_booking')
      .pipe(takeUntil(this.destroy$)) // Unsubscribe on component destroy
      .subscribe((data) => {
        this.incomingBooking = data.booking;
        this.startCountdown(data.expiresAt); // expiresAt is 5 minutes from booking creation
      });
  }

  /**
   * Subscribes to 'booking_expired' socket events from server.
   * Fired when auto-reject timeout completes (5 minutes elapsed).
   * Clears the incoming booking UI.
   */
  private listenForExpiredBookings(): void {
    this.socketService.on<any>('booking_expired')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.incomingBooking = null;
        this.clearCountdown();
      });
  }

  /**
   * Starts a 1-second interval countdown timer.
   * Updates timeRemaining every second until 0.
   * When 0, clears incoming booking UI.
   * @param expiresAt - ISO timestamp when booking expires
   */
  private startCountdown(expiresAt: string): void {
    this.clearCountdown(); // Clear any existing interval
    this.countdownInterval = setInterval(() => {
      const remaining = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      this.timeRemaining = remaining > 0 ? remaining : 0;
      if (this.timeRemaining === 0) {
        this.clearCountdown();
        this.incomingBooking = null;
      }
    }, 1000);
  }

  /**
   * Clears the countdown interval to prevent memory leaks.
   */
  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Accept incoming booking - sends status='Accepted' to backend.
   * Backend validates provider authorization and emits success events to user/provider rooms.
   * Clears UI and refreshes booking list on completion.
   */
  acceptBooking(bookingId: string): void {
    if (!bookingId) return;

    this.bookingService.updateStatus(bookingId, 'Accepted').subscribe(() => {
      this.incomingBooking = null;
      this.clearCountdown();
      this.loadMyBookings(); // Refresh to show updated status
    });
  }

  /**
   * Reject incoming booking - sends status='Rejected' with provider decline reason.
   * Backend emits rejection notification to user via socket.
   * Clears UI and refreshes booking list on completion.
   */
  rejectBooking(bookingId: string): void {
    if (!bookingId) return;

    this.bookingService.updateStatus(bookingId, 'Rejected', 'Provider declined').subscribe(() => {
      this.incomingBooking = null;
      this.clearCountdown();
      this.loadMyBookings();
    });
  }

  /**
   * Update booking status (In-Progress → Completed).
   * Only available after Accept. Refreshes booking list after update.
   */
  updateStatus(bookingId: string, status: string): void {
    if (!bookingId) return;

    this.bookingService.updateStatus(bookingId, status).subscribe(() => {
      this.loadMyBookings(); // Refresh to reflect status change
    });
  }

  /**
   * Fetch current provider's accepted and completed bookings.
   * Populates bookings list for history section.
   */
  loadMyBookings(): void {
    this.bookingService.getProviderBookings().subscribe((res: any) => {
      this.bookings = Array.isArray(res?.data) ? res.data : [];
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearCountdown();
  }
}
