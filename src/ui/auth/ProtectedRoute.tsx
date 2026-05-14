import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getClaimsFromAccessToken, isAccessTokenValid } from "../../state/session";

export default function ProtectedRoute({ allowRoles }: { allowRoles?: string[] }) {
  const location = useLocation();
  const valid = isAccessTokenValid();
  if (!valid) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (allowRoles && allowRoles.length) {
    const claims = getClaimsFromAccessToken();
    const roles = claims?.roles || [];
    const ok = roles.some((r) => allowRoles.includes(r));
    if (!ok) return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}

