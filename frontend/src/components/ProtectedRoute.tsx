import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { hasRouteAccess } from "@/lib/permissions";

export default function ProtectedRoute({
  children,
  allowedGroups,
  allowedLogins,
}: {
  children: ReactNode;
  allowedGroups?: string[];
  allowedLogins?: string[];
}) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loader">Carregando sessao...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!(user?.email || "").trim() && location.pathname !== "/primeiro-acesso") {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  if (!hasRouteAccess(user?.grupos ?? [], user?.nm_login, allowedGroups, allowedLogins)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
