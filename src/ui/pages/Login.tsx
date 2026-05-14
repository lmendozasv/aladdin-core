import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../../firebase/firebase";
import { authExchange } from "../../api/core";
import { setAccessToken } from "../../state/session";

export default function Login() {
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();
  const loc = useLocation() as any;

  async function exchangeAndGo() {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error("Not authenticated in Firebase");
    const idToken = await fbUser.getIdToken();
    const tokens = await authExchange(idToken);
    setAccessToken(tokens.access_token);
    const dest = loc?.state?.from || "/dashboard";
    nav(dest, { replace: true });
  }

  async function onSignIn() {
    setMsg(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      await exchangeAndGo();
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  }

  async function onSignUp() {
    setMsg(null);
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await exchangeAndGo();
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  }

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", mt: { xs: 2, md: 6 } }}>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4">Sign in</Typography>
        <Typography color="text.secondary">
          Authenticate with Firebase, then exchange for a STR JWT (RBAC roles + business scope).
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={onSignIn} disabled={!email || !password}>
                Sign in
              </Button>
              <Button variant="outlined" onClick={onSignUp} disabled={!email || !password}>
                Sign up
              </Button>
            </Stack>
            {msg ? <Alert severity="error">{msg}</Alert> : null}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

