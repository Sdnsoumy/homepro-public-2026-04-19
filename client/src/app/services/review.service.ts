import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  submitReview(bookingId: string, rating: number, comment: string, photos: File[]) {
    // Use FormData because we are uploading files alongside text
    const formData = new FormData();
    formData.append('bookingId', bookingId);
    formData.append('rating', rating.toString());
    formData.append('comment', comment);

    // 'photos' must match the field name in multer upload.array('photos', 3)
    photos.forEach(photo => formData.append('photos', photo));

    // Do NOT set Content-Type header manually — browser sets it automatically
    // with the correct multipart boundary when using FormData.
    // If set manually, server-side multipart parsing will fail due to missing/invalid boundary.
    return this.http.post(`${this.apiUrl}/reviews`, formData);
  }

  getProviderReviews(providerId: string) {
    return this.http.get(`${this.apiUrl}/reviews/provider/${providerId}`);
  }
}
