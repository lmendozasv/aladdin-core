import { Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function Forbidden() {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto", mt: 6 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Forbidden</Typography>
        <Typography color="text.secondary">Your role does not have access to this area.</Typography>
        <Button component={RouterLink} to="/dashboard" variant="outlined" sx={{ width: "fit-content" }}>
          Go to Dashboard
        </Button>
      </Stack>
    </Box>
  );
}

