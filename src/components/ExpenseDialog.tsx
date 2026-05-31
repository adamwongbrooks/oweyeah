import { useState, useEffect } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, FormControlLabel, FormLabel, InputAdornment,
  MenuItem, Radio, RadioGroup, Select, Stack, TextField, Typography,
} from '@mui/material';
import {
  addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ExpenseCategory, Group, Split, SplitType, Transaction, UserDoc } from '../types';

const CATEGORIES: ExpenseCategory[] = [
  'Restaurant/Bar', 'Utility', 'Grocery', 'Household Supply',
  'Entertainment', 'Travel', 'Gas',
];

function todayString(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function tsToDateStr(ts: Timestamp): string {
  const d = ts.toDate();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function dateStrToTs(s: string): Timestamp {
  const [y, m, day] = s.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, day));
}

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: Record<string, UserDoc>;
  group: Group;
  transaction: Transaction | null;
  currentUserId: string;
}

export default function ExpenseDialog({
  open, onClose, groupId, members, group, transaction, currentUserId,
}: Props) {
  const isEditing = !!transaction;
  const memberIds = group.memberUserIds;
  const memberName = (uid: string) => members[uid]?.displayName ?? uid;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayString());
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [participants, setParticipants] = useState<string[]>(memberIds);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setDescription(transaction.description);
      setAmount(String(transaction.amount));
      setDate(tsToDateStr(transaction.date));
      setCategory(transaction.category ?? '');
      setPaidBy(transaction.paidByUserId);
      setParticipants(transaction.splits.map((s) => s.userId));
      setSplitType(transaction.splitType);
      const ca: Record<string, string> = {};
      const pct: Record<string, string> = {};
      transaction.splits.forEach((s) => {
        ca[s.userId] = String(s.amount);
        if (s.percentage != null) pct[s.userId] = String(s.percentage);
      });
      setCustomAmounts(ca);
      setPercentages(pct);
    } else {
      setDescription('');
      setAmount('');
      setDate(todayString());
      setCategory('');
      setPaidBy(currentUserId);
      setParticipants([...memberIds]);
      setSplitType('equal');
      setCustomAmounts({});
      setPercentages({});
    }
    setError('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmount = parseFloat(amount) || 0;

  const toggleParticipant = (uid: string) =>
    setParticipants((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);

  const customSum = participants.reduce((s, uid) => s + (parseFloat(customAmounts[uid] ?? '0') || 0), 0);
  const customRemainder = Math.round((totalAmount - customSum) * 100) / 100;

  const pctSum = participants.reduce((s, uid) => s + (parseFloat(percentages[uid] ?? '0') || 0), 0);
  const pctRemainder = Math.round((100 - pctSum) * 100) / 100;

  function buildSplits(): Split[] {
    if (!participants.length) return [];
    if (splitType === 'equal') {
      const base = Math.floor((totalAmount / participants.length) * 100) / 100;
      const extra = Math.round((totalAmount - base * participants.length) * 100) / 100;
      return participants.map((uid, i) => ({ userId: uid, amount: i === 0 ? base + extra : base }));
    }
    if (splitType === 'custom') {
      return participants.map((uid) => ({
        userId: uid,
        amount: Math.round((parseFloat(customAmounts[uid] ?? '0') || 0) * 100) / 100,
      }));
    }
    return participants.map((uid) => {
      const pct = parseFloat(percentages[uid] ?? '0') || 0;
      return { userId: uid, amount: Math.round(totalAmount * pct / 100 * 100) / 100, percentage: pct };
    });
  }

  function validate(): string {
    if (!description.trim()) return 'Description is required.';
    if (!amount || totalAmount <= 0) return 'Amount must be greater than 0.';
    if (!date) return 'Date is required.';
    if (!participants.length) return 'Select at least one split participant.';
    if (splitType === 'custom' && Math.abs(customRemainder) > 0.01)
      return `Amounts must sum to $${totalAmount.toFixed(2)} — $${Math.abs(customRemainder).toFixed(2)} ${customRemainder > 0 ? 'remaining' : 'over'}.`;
    if (splitType === 'percentage' && Math.abs(pctRemainder) > 0.1)
      return `Percentages must sum to 100% — ${Math.abs(pctRemainder).toFixed(1)}% ${pctRemainder > 0 ? 'remaining' : 'over'}.`;
    return '';
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        amount: totalAmount,
        date: dateStrToTs(date),
        category: category || null,
        paidByUserId: paidBy,
        splitType,
        splits: buildSplits(),
        ...(isEditing ? {} : { createdBy: currentUserId, createdAt: serverTimestamp() }),
      };
      if (isEditing && transaction) {
        await updateDoc(doc(db, 'groups', groupId, 'transactions', transaction.id), payload);
      } else {
        await addDoc(collection(db, 'groups', groupId, 'transactions'), payload);
      }
      onClose();
    } catch {
      setError('Failed to save expense. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const equalPerPerson = participants.length > 0 && totalAmount > 0
    ? (totalAmount / participants.length).toFixed(2)
    : null;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Description"
            fullWidth
            required
            value={description}
            onChange={(e) => { setDescription(e.target.value); setError(''); }}
            disabled={saving}
          />

          <TextField
            label="Amount"
            fullWidth
            required
            type="number"
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
            fullWidth
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <FormControl fullWidth>
            <Select
              displayEmpty
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory | '')}
              disabled={saving}
              renderValue={(v) => v || <Typography color="text.secondary">Category (optional)</Typography>}
            >
              <MenuItem value="">None</MenuItem>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <FormLabel sx={{ mb: 0.5 }}>Who paid</FormLabel>
            <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} disabled={saving}>
              {memberIds.map((uid) => <MenuItem key={uid} value={uid}>{memberName(uid)}</MenuItem>)}
            </Select>
          </FormControl>

          <Divider />

          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 0.5 }}>Split participants</FormLabel>
            {memberIds.map((uid) => (
              <FormControlLabel
                key={uid}
                control={
                  <Checkbox
                    checked={participants.includes(uid)}
                    onChange={() => { toggleParticipant(uid); setError(''); }}
                    disabled={saving}
                  />
                }
                label={memberName(uid)}
              />
            ))}
          </FormControl>

          <Divider />

          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 0.5 }}>Split breakdown</FormLabel>
            <RadioGroup
              value={splitType}
              onChange={(e) => { setSplitType(e.target.value as SplitType); setError(''); }}
              row
            >
              <FormControlLabel value="equal" control={<Radio />} label="Equal" disabled={saving} />
              <FormControlLabel value="custom" control={<Radio />} label="By amount" disabled={saving} />
              <FormControlLabel value="percentage" control={<Radio />} label="By %" disabled={saving} />
            </RadioGroup>
          </FormControl>

          {splitType === 'equal' && equalPerPerson && (
            <Typography variant="body2" color="text.secondary">
              ${equalPerPerson} per person
            </Typography>
          )}

          {splitType === 'custom' && (
            <Stack spacing={1}>
              {participants.map((uid) => (
                <TextField
                  key={uid}
                  label={memberName(uid)}
                  type="number"
                  size="small"
                  value={customAmounts[uid] ?? ''}
                  onChange={(e) => { setCustomAmounts((p) => ({ ...p, [uid]: e.target.value })); setError(''); }}
                  disabled={saving}
                  slotProps={{
                    htmlInput: { min: 0, step: '0.01' },
                    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  }}
                />
              ))}
              <Typography variant="body2" color={Math.abs(customRemainder) < 0.01 ? 'success.main' : 'warning.main'}>
                ${customSum.toFixed(2)} of ${totalAmount.toFixed(2)}
                {Math.abs(customRemainder) >= 0.01 && ` · $${Math.abs(customRemainder).toFixed(2)} ${customRemainder > 0 ? 'remaining' : 'over'}`}
              </Typography>
            </Stack>
          )}

          {splitType === 'percentage' && (
            <Stack spacing={1}>
              {participants.map((uid) => (
                <TextField
                  key={uid}
                  label={memberName(uid)}
                  type="number"
                  size="small"
                  value={percentages[uid] ?? ''}
                  onChange={(e) => { setPercentages((p) => ({ ...p, [uid]: e.target.value })); setError(''); }}
                  disabled={saving}
                  slotProps={{
                    htmlInput: { min: 0, max: 100, step: '0.1' },
                    input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                  }}
                />
              ))}
              <Typography variant="body2" color={Math.abs(pctRemainder) < 0.1 ? 'success.main' : 'warning.main'}>
                {pctSum.toFixed(1)}% of 100%
                {Math.abs(pctRemainder) >= 0.1 && ` · ${Math.abs(pctRemainder).toFixed(1)}% ${pctRemainder > 0 ? 'remaining' : 'over'}`}
              </Typography>
            </Stack>
          )}

          {error && <Typography color="error" variant="body2">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
