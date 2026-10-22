export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  payer: 'AO' | 'MASA';
  memo: string;
}
