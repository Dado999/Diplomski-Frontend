import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BaseChartDirective, NgChartsModule} from 'ng2-charts';
import {Chart, registerables} from 'chart.js';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {SliderModule} from 'primeng/slider';
import {ButtonModule} from 'primeng/button';
import {MatSliderModule} from '@angular/material/slider';
import {MatButton} from '@angular/material/button';
import {HttpClient} from '@angular/common/http';
import {TransactionLimit} from '../transaction-limit';
import {ProcessedTransaction} from '../processed-transaction';

Chart.defaults.animation = false;
Chart.register(...registerables);
@Component({
  selector: 'app-analytics',
  imports: [ NgChartsModule, FormsModule, SliderModule, ButtonModule, CommonModule, MatSliderModule, MatButton, ReactiveFormsModule ],
  templateUrl: './analytics.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  styleUrl: './analytics.component.css'
})

export class AnalyticsComponent implements OnInit {

  minValue: number = 5000;
  maxValue: number = 2;
  totalAmount: number = 0;
  totalChartData :{ labels: string[]; datasets: { data: number[]; label: string, borderColor: string }[] } = { labels: [], datasets: [{data: [], label: "Total transaction amount", borderColor: 'green'} ] }
  regionChartData :{ labels: string[]; datasets: { data: number[]; label: string }[] } = { labels: ['EUROPE', 'AMERICA', 'ASIA', 'AUSTRALIA'], datasets: [ { data: [0, 0, 0, 0], label: "Transactions by Region", } ] };
  averageChartData :{ labels: string[]; datasets: { data: number[]; label: string, borderColor: string }[] } = { labels: [],  datasets: [ { data: [],  label: "Average transaction amount", borderColor: 'orange' } ] };
  responseTimeData :{ labels: string[]; datasets: { data: number[]; label: string, borderColor: string }[] } = { labels: [],  datasets: [ { data: [],  label: "Average system response time",  borderColor: 'brown' }, { data: [],  label: "Response time",  borderColor: 'blue' } ] };
  options = { responsive: true, maintainAspectRatio: true };
  transactions: number = 0;
  @ViewChildren(BaseChartDirective) charts!: QueryList<BaseChartDirective>;
  regionChart!: BaseChartDirective;
  responseChart!: BaseChartDirective;
  @ViewChildren('chartElement') chartElements!: QueryList<ElementRef>;
  activeChart: string | null = null;
  constructor(private cdr: ChangeDetectorRef,
              private http: HttpClient) {}
  ngOnInit(): void {
    this.connectToSSE();
  }
  ngAfterViewInit(): void {
    this.regionChart = this.charts.toArray()[2];
    this.responseChart = this.charts.toArray()[3];
  }

  setActiveChart(chartName: string, index: number): void {
    this.activeChart = this.activeChart === chartName ? null : chartName;

    if (this.activeChart) {
      const element = this.chartElements.toArray()[index].nativeElement;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  isActive(chartName: string): boolean {
    return this.activeChart === chartName;
  }
  connectToSSE(): void {
    const transactionSource = new EventSource('http://localhost:8079/transactions/sse');
    transactionSource.onmessage = (event) => {
      const newTransaction: ProcessedTransaction = JSON.parse(event.data);
      console.log(newTransaction.elapsedTime)
      this.transactions++;
      if(this.transactions % 100 == 0)
      {
        // this.updateRegionChartData(newTransaction.origin);
        this.updateResponseChart(newTransaction.elapsedTime)
        // this.updateAverageChart(newTransaction.averageAmount)
        // this.updateTotalChart(newTransaction.totalAmount)
        this.cdr.detectChanges();
      }
    };
    this.handleSSEError(transactionSource, () => this.connectToSSE());
  }
  handleSSEError(source: EventSource, reconnectFn: () => void): void {
    source.onerror = () => {
      console.error('SSE connection error. Reconnecting...');
      source.close();
      setTimeout(reconnectFn, 5000);
    };
  }
  updateAverageChart(averageAmount: number): void {
    this.averageChartData.labels.push((this.transactions).toString());
    this.averageChartData.datasets[0].data.push(averageAmount);
    if(this.charts.last.chart)
      this.charts.last.chart.update();
  }
  updateTotalChart(totalAmount: number): void {
    this.totalAmount = totalAmount;
    this.totalChartData.labels.push((this.transactions).toString());
    this.totalChartData.datasets[0].data.push(totalAmount);
    if(this.charts.first.chart)
      this.charts.first.chart.update();
  }
  updateResponseChart(responseTime: number): void {
    this.responseTimeData.labels.push((this.transactions).toString());
    this.responseTimeData.datasets[1].data.push(responseTime);
    this.responseTimeData.datasets[0].data = this.applyRollingAverage(this.responseTimeData.datasets[1].data, 100);
    this.responseChart.chart?.update();
  }

  private applyRollingAverage(data: number[], windowSize: number): number[] {
    return data.map((value, index, array) => {
      const start = Math.max(0, index - windowSize + 1);
      const subset = array.slice(start, index + 1);
      return subset.reduce((sum, val) => sum + val, 0) / subset.length;
    });
  }
  updateRegionChartData(region: string): void {
    const regionIndex = this.regionChartData.labels.indexOf(region);
    if (regionIndex === -1) {
      this.regionChartData = { ...this.regionChartData, labels: [...this.regionChartData.labels, region], datasets: [ { ...this.regionChartData.datasets[0], data: [...this.regionChartData.datasets[0].data, 1] } ] };
    } else {
      const updatedData = [...this.regionChartData.datasets[0].data];
      updatedData[regionIndex]++;
      this.regionChartData = { ...this.regionChartData, datasets: [ { ...this.regionChartData.datasets[0], data: updatedData } ] };
    }
    this.regionChart.chart?.update();
  }
  sendTransactionLimitsToBackend() {
    const settings: TransactionLimit = {
      transactionNumber: this.minValue,
      duration: this.maxValue,
    };
    this.http.post('http://localhost:8079/transactions/generate', settings).subscribe({
      next: () => console.log('Transaction limits updated successfully!'),
      error: (error) => {
        console.error('Failed to update transaction limits', error);
        alert('Failed to update transaction limits. Please try again.');
      },
    });
  }
}
