import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { userDoc, logOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogOut() {
    await logOut();
    navigate('/login');
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
        <Typography color="text.secondary">
          Your groups will appear here. Create one to get started.
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button variant="contained" size="large">
            Create Group
          </Button>
        </Box>
      </Container>
    </>
  );
}
