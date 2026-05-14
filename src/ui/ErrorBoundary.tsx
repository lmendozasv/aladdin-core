import React from "react";
import { Alert, Box, Typography } from "@mui/material";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err?: any }> {
  state: { err?: any } = {};

  static getDerivedStateFromError(err: any) {
    return { err };
  }

  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error("App crash:", err);
  }

  render() {
    if (this.state.err) {
      return (
        <Box sx={{ maxWidth: 860, mx: "auto", p: 3 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            STR Admin failed to load
          </Typography>
          <Alert severity="error">
            {String(this.state.err?.message || this.state.err || "Unknown error")}
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

