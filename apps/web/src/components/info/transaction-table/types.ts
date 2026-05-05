export interface Transaction {
  id: number;
  date: string;
  category: string | null;
  genre: string | null;
  name: string | null;
  place: string | null;
  amount: number;
  type: string; // "payment" | "income" | "transfer"
  fromAccount: string | null;
  toAccount: string | null;
  comment: string | null;
}

export type SortColumn = "date" | "name" | "category" | "type" | "amount";

export interface TransactionKpi {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  count: number;
  medianExpense: number;
}
