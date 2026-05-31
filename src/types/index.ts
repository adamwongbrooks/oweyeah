import type { Timestamp } from 'firebase/firestore';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  userId: string;
  memberUserIds: string[];
  pendingInvites: string[];
  createdAt: Timestamp;
}

export type SplitType = 'equal' | 'custom' | 'percentage';

export type ExpenseCategory =
  | 'Restaurant/Bar'
  | 'Utility'
  | 'Grocery'
  | 'Household Supply'
  | 'Entertainment'
  | 'Travel'
  | 'Gas';

export interface Split {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Timestamp;
  category?: ExpenseCategory;
  paidByUserId: string;
  splitType: SplitType;
  splits: Split[];
  createdBy: string;
  createdAt: Timestamp;
}

export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  date: Timestamp;
  note?: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Debt {
  fromUserId: string;
  toUserId: string;
  amount: number;
}
