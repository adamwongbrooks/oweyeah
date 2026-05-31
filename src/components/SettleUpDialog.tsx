import { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormLabel, InputAdornment, MenuItem, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Debt, Group, UserDoc } from '../types';

function todayString(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: Record<string, UserDoc>;
  group: Group;
  debts: Debt[];
  currentUserId: string;
}

export default function SettleUpDialog({
  open, onClose, groupId, members, group, debts, currentUserId,
}: Props) {
  const memberIds = group.memberUserIds;
  const memberName = (uid: string) => members[uid]?.displayName ?? uid;

  const [from, setFrom] = useState(currentUserId);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayString());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function applyDebtForFrom(uid: string) {
    const debt = debts.find((d) => d.fromUserId === uid);
    if (debt) {
      setTo(debt.toUserId);
      setAmount(debt.amount.toFixed(2));
    } else {
      setTo(memberIds.find((id) => id !== uid) ?? '');
      setAmount('');
    }
  }

  useEffect(() => {
    if (!open) return;
    setDate(todayString());
    setNote('');
    setError('');
    setFrom(currentUserId);
    applyDebtForFrom(currentUserId);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFromChange(uid: string) {
    setFrom(uid);
    applyDebtForFrom(uid);
  }

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (!from || !to) { setError('Select who is paying and who is receiving.'); return; }
    if (from === to) { setError('Payer and receiver must be different.'); return; }
    if (!parsed || parsed <= 0) { setError('Amount must be greater than 0.'); return; }
    if (!date) { setError('Date is required.'); return; }

    setSaving(true);
    setError('');
    try {
      const [y, m, day] = date.split('-').map(Number);
      await addDoc(collection(db, 'groups', groupId, 'settlements'), {
        fromUserId: from,
        toUserId: to,
        amount: parsed,
        date: Timestamp.fromDate(new Date(y, m - 1, day)),
        note: note.trim() || null,
        createdBy: currentUserId,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError('Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const toOptions = memberIds.filter((uid) => uid !== from);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Settle Up</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <FormLabel sx={{ mb: 0.5 }}>Who paid</FormLabel>
            <Select value={from} onChange={(e) => handleFromChange(e.target.value)} disabled={saving}>
              {memberIds.map((uid) => <MenuItem key={uid} value={uid}>{memberName(uid)}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <FormLabel sx={{ mb: 0.5 }}>Paid to</FormLabel>
            <Select value={to} onChange={(e) => setTo(e.target.value)} disabled={saving}>
              {toOptions.map((uid) => <MenuItem key={uid} value={uid}>{memberName(uid)}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField
            label="Amount"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(''); }}
            disabled={saving}
            slotProps={{
              htmlInput: { min: 0, step: '0.01' },
              input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
            }}
          />

          <TextField
            label="Date"
            type="date"
            fullWidth
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label="Note (optional)"
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
          />

          {error && <Typography color="error" variant="body2">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Record Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
