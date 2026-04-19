/**
 * Smart Recommendations Component
 * 
 * Displays seasonal service recommendations based on current month
 * Frontend of the smart recommendations system
 * 
 * Flow:
 * 1. OnInit: Fetch GET /api/recommendations
 * 2. Backend returns month and recommended categories
 * 3. Display as clickable chips
 * 4. User can click to filter providers or book directly
 * 
 * Categories: 'Electrician','Plumber','Home Cleaning','Carpenter','Painter','AC Repair'
 */

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="recommendations" *ngIf="recommendations.length > 0">
      <h3>Recommended for {{ month }}</h3>
      <div class="rec-chips">
        <span class="chip" *ngFor="let category of recommendations"
          (click)="onCategorySelect(category)"
          role="button"
          tabindex="0">
          {{ category }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .recommendations {
      padding: 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #bbf7d0;
      margin-bottom: 16px;
    }

    h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #047857;
    }

    .rec-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      padding: 6px 12px;
      border-radius: 20px;
      background: white;
      border: 1px solid #10b981;
      color: #047857;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-block;
      user-select: none;
    }

    .chip:hover {
      background: #d1fae5;
      border-color: #059669;
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
    }

    .chip:active {
      transform: translateY(0);
    }
  `]
})
export class RecommendationsComponent implements OnInit {
  recommendations: string[] = [];
  month = '';

  /**
   * Emits when user selects a recommended category
   * Parent component (e.g., map) can listen to filter providers
   */
  @Output() categorySelected = new EventEmitter<string>();

  constructor(private http: HttpClient) {}

  /**
   * Fetch seasonal recommendations on component initialization
   * Calls GET /api/recommendations to get month-specific categories
   */
  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/recommendations`).subscribe({
      next: (res) => {
        this.recommendations = res.recommendations;
        this.month = res.month;
      },
      error: (err) => {
        console.error('Failed to fetch recommendations:', err);
      }
    });
  }

  /**
   * Handle category selection
   * Emits category name to parent component for filtering
   * Parent (map/dashboard) can use to filter providers by category
   * 
   * @param category - Service category name (e.g., 'AC Repair')
   */
  onCategorySelect(category: string): void {
    this.categorySelected.emit(category);
    console.log('Selected category:', category);
  }
}
