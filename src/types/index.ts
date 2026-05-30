import type { Timestamp } from 'firebase/firestore';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
}

// Field names must match firestore.rules:
//   isGroupMember  → memberUserIds array contains request.auth.uid
//   isGroupOwner   → userId == request.auth.uid
export interface Group {
  id: string;
  name: string;
  userId: string;          // owner uid
  memberUserIds: string[]; // all members including owner
  createdAt: Timestamp;
}

export type SplitType = 'equal' | 'percentage' | 'custom';

export interface Split {
  userId: string;
  amount: number; // resolved dollar amount this member owes
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  paidByUserId: string;
  splitType: SplitType;
  splits: Split[];
  createdAt: Timestamp;
  settledAt?: Timestamp;
}
