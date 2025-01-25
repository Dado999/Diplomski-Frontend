import {Transaction} from './transaction';

export interface ProcessedTransaction {
    transactionDTO: Transaction
    totalAmount: number;
    averageAmount: number;
    origin: string;
    elapsedTime: number;
}
