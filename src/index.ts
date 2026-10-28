// src/types.ts

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  payer: 'AO' | 'MASA';
  memo: string;
}

export interface CategoryItem {
  id: string;
  name: string;
}

export interface Trip {
  id: string;
  title: string;
  start_date: string;
}

export interface TripExpense {
  id: string;
  trip_id: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  payer: 'AO' | 'MASA';
  memo: string;
}