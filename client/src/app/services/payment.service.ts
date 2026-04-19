import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Razorpay Payment Service
 * 
 * Handles complete payment flow:
 * 1. Creates Razorpay order on server (POST /payments/create-order)
 * 2. Opens Razorpay checkout modal with user details
 * 3. After payment, verifies signature on server (POST /payments/verify)
 * 4. Returns promise resolving on success or rejecting on failure
 * 
 * Razorpay script must be loaded via <script> tag in index.html:
 * <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 * 
 * Usage:
 * this.paymentService.initiatePayment(bookingId, userName, userEmail)
 *   .then(() => console.log('Payment successful'))
 *   .catch((err) => console.error('Payment failed', err));
 */

declare var Razorpay: any; // Global Razorpay object loaded via script tag

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Initiates complete Razorpay payment flow
   * 
   * @param bookingId MongoDB ObjectId of the booking to pay for
   * @param userName User's name (prefilled in checkout)
   * @param userEmail User's email (prefilled in checkout)
   * @returns Promise that resolves after successful payment verification
   * 
   * Flow:
   * 1. POST /payments/create-order → get Razorpay orderId
   * 2. Open Razorpay checkout modal with Razorpay(options).open()
   * 3. User enters card details and confirms payment
   * 4. Razorpay returns razorpay_order_id, razorpay_payment_id, razorpay_signature
   * 5. POST /payments/verify with signature for server-side HMAC validation
   * 6. Resolve/reject promise based on verification result
   */
  initiatePayment(bookingId: string, userName: string, userEmail: string): Promise<void> {
    return new Promise((resolve, reject) => {

      // Step 1 — Create order on server (generates Razorpay orderId)
      this.http.post<any>(`${this.apiUrl}/payments/create-order`, { bookingId })
        .subscribe({
          next: (res) => {
            // Step 2 — Configure Razorpay checkout options
            const options = {
              key:         res.keyId,                    // Razorpay public key
              amount:      res.order.amount,             // Amount in paise (converted on server)
              currency:    res.order.currency,           // 'INR'
              name:        'HomePro',                    // Merchant name
              description: 'Home Service Payment',       // Payment description
              order_id:    res.order.id,                 // Razorpay order ID
              prefill: {
                name:  userName,                         // Auto-fill user name
                email: userEmail,                        // Auto-fill user email
              },
              theme: { color: '#4F46E5' },              // Primary brand color

              // Step 3 — Payment success handler
              // Called after user completes payment in checkout modal
              handler: (response: any) => {
                // response contains: razorpay_order_id, razorpay_payment_id, razorpay_signature
                this.http.post<any>(`${this.apiUrl}/payments/verify`, {
                  bookingId,
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                }).subscribe({
                  next:  () => resolve(),                // Payment verified — success
                  error: (err) => reject(err),           // Signature verification failed — fraud/tampering
                });
              },

              // Payment cancelled by user
              modal: {
                ondismiss: () => reject(new Error('Payment cancelled by user')),
              }
            };

            // Step 2b — Open Razorpay checkout modal
            const rzp = new Razorpay(options);
            
            // Handle payment failure (network errors, card declined, etc.)
            rzp.on('payment.failed', (response: any) => {
              reject(new Error(response.error.description));
            });
            
            rzp.open();
          },
          error: reject,  // Order creation failed
        });
    });
  }
}
