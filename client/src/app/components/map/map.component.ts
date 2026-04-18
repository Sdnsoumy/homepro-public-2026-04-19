import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit {
  manualSearchQuery: string = '';
  locationError: string | null = null;
  selectedCategory: string = '';
  isLoading: boolean = false;
  
  // Dummy data beautifully populated to demonstration the breathtaking UI right away
  providers: any[] = [];

  ngOnInit(): void {
    // Add dummy providers for UI visual check
    this.providers = [
      {
        user: { name: 'Arjun Kumar' },
        category: 'Electrician',
        hourlyRate: 350,
        avgRating: 4.8,
        badge: 'Gold'
      },
      {
        user: { name: 'Priya Sharma' },
        category: 'Cleaning',
        hourlyRate: 200,
        avgRating: 4.9,
        badge: 'Silver'
      },
      {
        user: { name: 'Rajesh Singh' },
        category: 'Plumber',
        hourlyRate: 400,
        avgRating: 4.6,
        badge: 'Bronze'
      },
      {
        user: { name: 'Sanjay Woodworks' },
        category: 'Carpenter',
        hourlyRate: 450,
        avgRating: 4.7,
        badge: 'Gold'
      }
    ];

    // Simulate leaflet map injection mock
    this.initMapDemo();
  }

  searchByAddress(): void {
    if (!this.manualSearchQuery) return;
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
    }, 1500);
  }

  onCategoryChange(category: string): void {
    this.selectedCategory = category;
  }

  bookProvider(provider: any): void {
    alert(`Booking workflow started for ${provider.user.name}`);
  }

  initMapDemo(): void {
    // Basic gray background to emulate map visually until leaflet connects
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
      mapDiv.style.background = '#e2e8f0 url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23cbd5e1\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")';
      mapDiv.style.backgroundSize = '40px 40px';
    }
  }
}
