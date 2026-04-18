import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ProviderService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getNearbyProviders(lat: number, lng: number, category: string = '') {
    let params = new HttpParams()
      .set('lat', lat.toString())
      .set('lng', lng.toString())
      .set('radius', '10000'); // 10km in metres

    if (category) {
      params = params.set('category', category);
    }

    return this.http.get(`${this.apiUrl}/providers/nearby`, { params });
  }
}