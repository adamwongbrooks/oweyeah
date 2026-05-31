import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import { arrayUnion, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Group } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  group: Group;
}

export default function InviteDialog({ open, onClose, groupId, group }: Props) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Enter a valid email address.'); return; }

    setSending(true);
    setError('');
    setSuccess('');
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', trimmed)));
      const groupRef = doc(db, 'groups', groupId);

      if (!snap.empty) {
        const uid = snap.docs[0].id;
        if (group.memberUserIds.includes(uid)) {
          setError('This person is already a member.');
          return;
        }
        const displayName = snap.docs[0].data().displayName as string;
        await updateDoc(groupRef, { memberUserIds: arrayUnion(uid) });
        setSuccess(`${displayName} has been added to the group.`);
      } else {
        if ((group.pendingInvites ?? []).includes(trimmed)) {
          setError('This email already has a pending invite.');
          return;
        }
        await updateDoc(groupRef, { pendingInvites: arrayUnion(trimmed) });
        setSuccess(`Invite sent — ${trimmed} will be added when they sign up.`);
      }
      setEmail('');
    } catch {
      setError('Failed to send invite. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setEmail('');
    setError('');
    setSuccess('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={sending ? undefined : handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Invite to Group</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Email address"
          type="email"
          fullWidth
          sx={{ mt: 1 }}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); setSuccess(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
          error={!!error}
          helperText={error}
          disabled={sending}
        />
        {success && (
          <Typography color="success.main" variant="body2" sx={{ mt: 1.5 }}>
            {success}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={sending}>Close</Button>
        <Button variant="contained" onClick={handleInvite} disabled={sending}>
          {sending ? 'Sending…' : 'Invite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
