import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AppBar, Box, Card, CardContent, CircularProgress, Container,
  IconButton, List, ListItem, ListItemButton, ListItemText,
  Toolbar, Typography, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  collection, doc, getDoc, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Debt, Group, Settlement, Transaction, UserDoc } from '../types';
import ExpenseDialog from '../components/ExpenseDialog';
import InviteDialog from '../components/InviteDialog';
import SettleUpDialog from '../components/SettleUpDialog';

function calculateDebts(
  transactions: Transaction[],
  settlements: Settlement[],
  memberIds: string[],
): Debt[] {
  const net: Record<string, number> = {};
  memberIds.forEach((uid) => { net[uid] = 0; });

  for (const tx of transactions) {
    if (tx.paidByUserId in net) net[tx.paidByUserId] += tx.amount;
    for (const split of tx.splits) {
      if (split.userId in net) net[split.userId] -= split.amount;
    }
  }

  for (const s of settlements) {
    if (s.fromUserId in net) net[s.fromUserId] -= s.amount;
    if (s.toUserId in net) net[s.toUserId] += s.amount;
  }

  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0.005)
    .map(([uid, amount]) => ({ uid, amount }));
  const debtors = Object.entries(net)
    .filter(([, v]) => v < -0.005)
    .map(([uid, amount]) => ({ uid, amount: -amount }));

  const debts: Debt[] = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amount, debtors[j].amount);
    debts.push({
      fromUserId: debtors[j].uid,
      toUserId: creditors[i].uid,
      amount: Math.round(amount * 100) / 100,
    });
    creditors[i].amount -= amount;
    debtors[j].amount -= amount;
    if (creditors[i].amount < 0.005) i++;
    if (debtors[j].amount < 0.005) j++;
  }
  return debts;
}

function fmtDate(ts: { toDate: () => Date }): string {
  return ts.toDate().toLocaleDateString();
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Record<string, UserDoc>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [txLoaded, setTxLoaded] = useState(false);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    return onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() } as Group);
    });
  }, [groupId]);

  // Fetch user docs whenever member list changes
  const memberIdsKey = group?.memberUserIds.slice().sort().join(',') ?? '';
  useEffect(() => {
    if (!group?.memberUserIds.length) return;
    Promise.all(group.memberUserIds.map((uid) => getDoc(doc(db, 'users', uid)))).then((snaps) => {
      const map: Record<string, UserDoc> = {};
      snaps.forEach((s) => { if (s.exists()) map[s.id] = s.data() as UserDoc; });
      setMembers(map);
    });
  }, [memberIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!groupId) return;
    return onSnapshot(
      query(collection(db, 'groups', groupId, 'transactions'), orderBy('date', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
        setTxLoaded(true);
      },
    );
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    return onSnapshot(
      collection(db, 'groups', groupId, 'settlements'),
      (snap) => setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Settlement))),
    );
  }, [groupId]);

  const debts = useMemo(
    () => (group ? calculateDebts(transactions, settlements, group.memberUserIds) : []),
    [transactions, settlements, group?.memberUserIds.join(',')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const memberName = (uid: string) => members[uid]?.displayName ?? uid;

  if (!group || !txLoaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => navigate('/')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>{group.name}</Typography>
          <IconButton color="inherit" onClick={() => setInviteOpen(true)} title="Invite member">
            <PersonAddIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 3, pb: 6 }}>
        {/* Balance summary */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Balances</Typography>
            {debts.length === 0 ? (
              <Typography color="text.secondary">All settled up!</Typography>
            ) : (
              debts.map((d, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{memberName(d.fromUserId)}</strong>
                  {' owes '}
                  <strong>{memberName(d.toUserId)}</strong>
                  {' '}
                  <strong>${d.amount.toFixed(2)}</strong>
                </Typography>
              ))
            )}
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" size="small" onClick={() => setSettleOpen(true)}>
                Settle Up
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Members */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Members: {group.memberUserIds.map(memberName).join(', ')}
          {(group.pendingInvites ?? []).length > 0 && (
            <> · Pending invites: {group.pendingInvites.join(', ')}</>
          )}
        </Typography>

        {/* Expenses */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Expenses</Typography>
          <Button variant="contained" onClick={() => { setEditing(null); setExpenseOpen(true); }}>
            + Add Expense
          </Button>
        </Box>

        {transactions.length === 0 ? (
          <Typography color="text.secondary">No expenses yet.</Typography>
        ) : (
          <List disablePadding>
            {transactions.map((tx) => (
              <ListItem key={tx.id} disablePadding divider>
                <ListItemButton onClick={() => { setEditing(tx); setExpenseOpen(true); }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">{tx.description}</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, ml: 2 }}>
                          ${tx.amount.toFixed(2)}
                        </Typography>
                      </Box>
                    }
                    secondary={[
                      `${memberName(tx.paidByUserId)} paid`,
                      fmtDate(tx.date),
                      tx.category,
                    ].filter(Boolean).join(' · ')}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Container>

      <ExpenseDialog
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        groupId={groupId!}
        members={members}
        group={group}
        transaction={editing}
        currentUserId={currentUser!.uid}
      />

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={groupId!}
        group={group}
      />

      <SettleUpDialog
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        groupId={groupId!}
        members={members}
        group={group}
        debts={debts}
        currentUserId={currentUser!.uid}
      />
    </>
  );
}
