import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { ProviderService } from '../../services/provider.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  manualSearchQuery: string = '';
  locationError: string | null = null;
  selectedCategory: string = '';
  isLoading: boolean = false;
  providers: any[] = [];

  private leaflet: typeof import('leaflet') | null = null;
  private map: any = null;
  private markersLayer: any = null;
  private readonly destroy$ = new Subject<void>();
  private readonly moveEnd$ = new Subject<void>();
  private readonly minSearchZoom = 11;
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private providerService: ProviderService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.moveEnd$
      .pipe(debounceTime(600), takeUntil(this.destroy$))
      .subscribe(() => this.loadNearbyProviders());

    void this.initializeLeafletMap();
  }

  searchByAddress(): void {
    if (!this.map) {
      return;
    }
    this.loadNearbyProviders();
  }

  onCategoryChange(category: string): void {
    this.selectedCategory = category;
    this.loadNearbyProviders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.moveEnd$.complete();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  bookProvider(provider: any): void {
    alert(`Booking workflow started for ${provider?.user?.name || 'provider'}`);
  }

  private fixLeafletDefaultIcons(): void {
    if (!this.leaflet) {
      return;
    }

    this.leaflet.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png'
    });
  }

  private async initializeLeafletMap(): Promise<void> {
    // Load Leaflet only on browser runtime to keep SSR route extraction safe.
    this.leaflet = await import('leaflet');
    this.markersLayer = this.leaflet.layerGroup();
    this.fixLeafletDefaultIcons();
    this.initMap();
    this.requestCurrentLocation();
  }

  private initMap(): void {
    if (!this.leaflet) {
      return;
    }

    this.map = this.leaflet.map('map', { zoomControl: true }).setView([20.2961, 85.8245], 12);

    this.leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);

    this.map.on('moveend', () => {
      this.moveEnd$.next();
    });
  }

  private requestCurrentLocation(): void {
    if (!this.isBrowser) {
      return;
    }

    if (!navigator.geolocation) {
      this.locationError = 'Geolocation is not supported by your browser.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!this.map) {
          return;
        }
        this.locationError = null;
        this.map.setView([position.coords.latitude, position.coords.longitude], 13);
        this.loadNearbyProviders();
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            this.locationError = 'Location permission denied. Enable GPS permission to see nearby providers.';
            break;
          case error.POSITION_UNAVAILABLE:
            this.locationError = 'Location information is unavailable right now.';
            break;
          case error.TIMEOUT:
            this.locationError = 'Location request timed out. Please try again.';
            break;
          default:
            this.locationError = 'Unable to fetch your location.';
        }

        this.loadNearbyProviders();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private loadNearbyProviders(): void {
    if (!this.map) {
      return;
    }

    const zoom = this.map.getZoom();
    // Avoid low-zoom requests that create noisy, high-volume API traffic.
    if (zoom < this.minSearchZoom) {
      this.providers = [];
      this.markersLayer.clearLayers();
      this.locationError = `Zoom in to level ${this.minSearchZoom} or higher to search.`;
      return;
    }

    const center = this.map.getCenter();
    this.isLoading = true;
    this.locationError = null;

    this.providerService
      .getNearbyProviders(center.lat, center.lng, this.selectedCategory)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const providers = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];

          this.providers = providers;
          this.renderMarkers(providers);
          this.isLoading = false;
        },
        error: () => {
          this.providers = [];
          this.markersLayer.clearLayers();
          this.locationError = 'Unable to load nearby providers at the moment.';
          this.isLoading = false;
        }
      });
  }

  private renderMarkers(providers: any[]): void {
    if (!this.leaflet || !this.markersLayer) {
      return;
    }
    const leaflet = this.leaflet;

    this.markersLayer.clearLayers();

    providers.forEach((provider) => {
      const coordinates = provider?.location?.coordinates;
      // Ignore malformed records rather than crashing marker rendering.
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return;
      }

      const [lng, lat] = coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return;
      }

      leaflet.marker([lat, lng])
        .bindPopup(this.getPopupContent(provider))
        .addTo(this.markersLayer);
    });
  }

  private getPopupContent(provider: any): string {
    const name = provider?.user?.name || 'Unnamed provider';
    const category = provider?.category || 'General service';
    const hourlyRate = typeof provider?.hourlyRate === 'number' ? `₹${provider.hourlyRate}/hr` : 'Rate unavailable';
    const rating = typeof provider?.avgRating === 'number' ? provider.avgRating.toFixed(1) : 'N/A';
    const badge = provider?.badge || 'Standard';

    return `<strong>${name}</strong><br/>${category}<br/>${hourlyRate}<br/>Rating: ${rating}<br/>${badge} badge`;
  }

  getProviderName(provider: any): string {
    return provider?.user?.name || 'Unnamed provider';
  }

  getProviderCategory(provider: any): string {
    return provider?.category || 'General';
  }

  getProviderRate(provider: any): string {
    return typeof provider?.hourlyRate === 'number' ? `${provider.hourlyRate}` : 'N/A';
  }

  getProviderRating(provider: any): string {
    return typeof provider?.avgRating === 'number' ? provider.avgRating.toFixed(1) : 'N/A';
  }

  getProviderBadge(provider: any): string {
    return provider?.badge || 'Standard';
  }

  trackByProvider(index: number, provider: any): string {
    return provider?._id || provider?.user?._id || provider?.user?.email || `${index}`;
  }
}
