import { useEffect, useState } from 'react';
import {
  AppBar, Box, Button, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, List, ListItem, ListItemText, TextField, Toolbar, Typography,
} from '@mui/material';
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, where,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Group } from '../types';

export default function Dashboard() {
  const { currentUser: user, userDoc, logOut } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'groups'),
      where('memberUserIds', 'array-contains', user.uid),
    );
    return onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
    });
  }, [user]);

  async function handleLogOut() {
    await logOut();
    navigate('/login');
  }

  function openDialog() {
    setGroupName('');
    setError('');
    setDialogOpen(true);
  }

  function closeDialog() {
    if (creating) return;
    setDialogOpen(false);
  }

  async function handleCreate() {
    const name = groupName.trim();
    if (!name) { setError('Group name is required.'); return; }
    if (!user) return;
    setCreating(true);
    try {
      await addDoc(collection(db, 'groups'), {
        name,
        userId: user.uid,
        memberUserIds: [user.uid],
        createdAt: serverTimestamp(),
      });
      setDialogOpen(false);
    } catch (e) {
      setError('Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            OweYeah
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.85 }}>
            {userDoc?.displayName ?? userDoc?.email}
          </Typography>
          <Button color="inherit" onClick={handleLogOut}>
            Log Out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Welcome, {userDoc?.displayName ?? 'there'}!
        </Typography>

        {groups.length === 0 ? (
          <Typography color="text.secondary">
            Your groups will appear here. Create one to get started.
          </Typography>
        ) : (
          <List disablePadding>
            {groups.map((g) => (
              <ListItem key={g.id} divider sx={{ px: 0 }}>
                <ListItemText
                  primary={g.name}
                  secondary={`${g.memberUserIds.length} member${g.memberUserIds.length !== 1 ? 's' : ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ mt: 4 }}>
          <Button variant="contained" size="large" onClick={openDialog}>
            Create Group
          </Button>
        </Box>
      </Container>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Create Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Group name"
            fullWidth
            variant="outlined"
            sx={{ mt: 1 }}
            value={groupName}
            onChange={(e) => { setGroupName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            error={!!error}
            helperText={error}
            disabled={creating}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
