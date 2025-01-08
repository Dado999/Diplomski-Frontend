import {ChangeDetectorRef, Component, OnInit, QueryList, ViewChildren} from '@angular/core';
import {CommonModule, CurrencyPipe, DatePipe, NgForOf} from '@angular/common';
import {Transaction} from '../transaction';
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

Chart.register(...registerables);
@Component({
  selector: 'app-analytics',
  imports: [ NgForOf, CurrencyPipe, DatePipe, NgChartsModule, FormsModule, SliderModule, ButtonModule, CommonModule, MatSliderModule, MatButton, ReactiveFormsModule ],
  templateUrl: './analytics.component.html',
  standalone: true,
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  minValue: number = -500;
  maxValue: number = 500;
  totalAmount: number = 0;
  totalChartData :{ labels: string[]; datasets: { data: number[]; label: string, borderColor: string }[] } = { labels: [], datasets: [{data: [], label: "Total transaction amount", borderColor: 'green'} ] }
  regionChartData :{ labels: string[]; datasets: { data: number[]; label: string }[] } = { labels: ['EUROPE', 'AMERICA', 'ASIA', 'AUSTRALIA'], datasets: [ { data: [0, 0, 0, 0], label: "Transactions by Region", } ] };
  averageChartData :{ labels: string[]; datasets: { data: number[]; label: string, borderColor: string }[] } = { labels: [],  datasets: [ { data: [],  label: "Average transaction amount", borderColor: 'orange' } ] };
  bankCollapseData :{ labels: string[]; datasets: { data: number[]; label: string, borderColor: string }[] } = { labels: [],  datasets: [ { data: [],  label: "Bank collapse probability",  borderColor: 'red' } ] };
  options = { responsive: true, maintainAspectRatio: true };
  transactions: Transaction[] = [];
  @ViewChildren(BaseChartDirective) charts!: QueryList<BaseChartDirective>;
  regionChart!: BaseChartDirective;
  collapseChart!: BaseChartDirective;

  constructor(private cdr: ChangeDetectorRef,
              private http: HttpClient) {}
  ngOnInit(): void {
    this.connectToSSE();
  }
  ngAfterViewInit(): void {
    this.regionChart = this.charts.toArray()[2];
    this.collapseChart = this.charts.toArray()[3];
  }
  connectToSSE(): void {
    const transactionSource = new EventSource('http://localhost:8079/transactions/sse');

    transactionSource.onmessage = (event) => {
      const newTransaction: ProcessedTransaction = JSON.parse(event.data);
      this.transactions.unshift(newTransaction.transactionDTO);
      this.updateAverageChart(newTransaction.averageAmount)
      this.updateTotalChart(newTransaction.totalAmount)
      this.updateRegionChartData(newTransaction.origin)
      this.cdr.detectChanges();
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
    const transactionCount = this.averageChartData.labels.length + 1;
    this.averageChartData.labels.push(transactionCount.toString());
    this.averageChartData.datasets[0].data.push(averageAmount);
    if(this.charts.last.chart)
      this.charts.last.chart.update();
  }
  updateTotalChart(totalAmount: number): void {
    const transactionCount = this.totalChartData.labels.length + 1;
    this.totalChartData.labels.push(transactionCount.toString());
    this.totalChartData.datasets[0].data.push(totalAmount);
    if(this.charts.first.chart)
      this.charts.first.chart.update();
    this.updateBankCollapseChart();
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
    const limit: TransactionLimit = {
      minValue: this.minValue,
      maxValue: this.maxValue,
    };
    this.http.post('http://localhost:8079/settings/set-limit', limit).subscribe({
      next: () => console.log('Transaction limits updated successfully!'),
      error: (error) => {
        console.error('Failed to update transaction limits', error);
        alert('Failed to update transaction limits. Please try again.');
      },
    });
  }
  private updateBankCollapseChart(): void {
    const probability = this.getBankCollapseProbability(this.totalAmount);
    const nextLabelIndex = this.bankCollapseData.labels.length + 1;
    this.bankCollapseData.labels.push(nextLabelIndex.toString());
    this.bankCollapseData.datasets[0].data.push(probability);
    this.collapseChart.chart?.update();
  }
  private getBankCollapseProbability(totalAmount: number): number {
    if (totalAmount >= 0) {
      return 0;
    }
    const collapseThreshold = -4_000_00;
    return Number((Math.abs(totalAmount) / Math.abs(collapseThreshold)).toFixed(4));
  }
}
