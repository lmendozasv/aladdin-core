import {
  AppBar,
  Box,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GridOnIcon from "@mui/icons-material/GridOn";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import TuneIcon from "@mui/icons-material/Tune";
import { PropsWithChildren, useMemo, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { clearSession } from "../../state/session";
import { firebaseAuth } from "../../firebase/firebase";

const drawerWidth = 280;
const drawerCollapsedWidth = 76;

type NavItem = { to: string; label: string; icon: React.ReactNode };

export default function AppShell({ title, children }: PropsWithChildren<{ title: string }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const items: NavItem[] = useMemo(
    () => [
      { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
      { to: "/assets", label: "Assets", icon: <HomeWorkIcon /> },
      { to: "/calendar", label: "Calendar", icon: <CalendarMonthIcon /> },
      { to: "/heatmap", label: "Heatmap", icon: <GridOnIcon /> },
      { to: "/pricing/rules", label: "Rules Engine", icon: <TuneIcon /> }
    ],
    []
  );

  const drawer = (
    <Box sx={{ height: "100%" }}>
      <Toolbar sx={{ px: 2, gap: 1 }}>
        {!collapsed ? (
          <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </Typography>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        {/* collapse control lives in top AppBar (MenuIcon) for clarity */}
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {items.map((it) => {
          const btn = (
            <ListItemButton
              key={it.to}
              component={RouterLink}
              to={it.to}
              selected={pathname === it.to}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2,
                my: 0.5,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1 : 1.5
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? "auto" : 40, color: "inherit" }}>{it.icon}</ListItemIcon>
              {!collapsed ? <ListItemText primary={it.label} primaryTypographyProps={{ fontWeight: 600 }} /> : null}
            </ListItemButton>
          );
          return collapsed ? (
            <Tooltip key={it.to} title={it.label} placement="right">
              {btn}
            </Tooltip>
          ) : (
            btn
          );
        })}
      </List>
      <Box sx={{ px: 2, pb: 2, mt: "auto" }}>
        <Divider sx={{ mb: 2 }} />
        {!collapsed ? (
          <Typography variant="caption" color="text.secondary">
            Aladdin Price Engine v0.1.0
          </Typography>
        ) : null}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => {
              if (isDesktop) {
                setCollapsed((v) => !v);
              } else {
                setMobileOpen((v) => !v);
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          
          {/* {isDesktop ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
              {collapsed ? "Collapsed" : "Expanded"}
            </Typography>
          ) : null} */}
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.25 }}>
            {title}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Environment">
            <Chip size="small" label={import.meta.env.MODE} />
          </Tooltip>
          <Tooltip title="Sign out">
            <IconButton
              onClick={async () => {
                clearSession();
                try {
                  await firebaseAuth?.signOut();
                } catch {
                  // ignore
                }
                window.location.href = "/login";
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: collapsed ? drawerCollapsedWidth : drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: collapsed ? drawerCollapsedWidth : drawerWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: (t) => t.transitions.create("width", { duration: t.transitions.duration.shortest })
            }
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, mt: 8, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
