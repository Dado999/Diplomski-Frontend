export interface Transaction {
  id: number;
  userId: number;
  createdDate: string;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
}
