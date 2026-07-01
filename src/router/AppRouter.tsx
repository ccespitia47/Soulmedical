import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { ROLE_PERMISSIONS } from "../types/auth.types";
import { useAuthRestore } from "../hooks/useAuthRestore";
import ProtectedRoute from "./ProtectedRoute";
import LoginRoute from "./routes/LoginRoute";
import {
  ForgotPasswordRoute,
  RegisterRoute,
  ResetPasswordRoute,
} from "./routes/AuthRoutes";
import AdminRoute from "./routes/AdminRoute";
import UserAppRoute from "./routes/UserAppRoute";
import BuilderRoute from "./routes/BuilderRoute";
import FormRoute from "./routes/FormRoute";
import ConsientifyRoute from "./routes/ConsientifyRoute";

function RootRedirect() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  const dest = ROLE_PERMISSIONS[user.role].canManageProjects ? "/admin" : "/userapp";
  return <Navigate to={dest} replace />;
}

export default function AppRouter() {
  const { ready } = useAuthRestore();
  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterRoute />} />
      <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
      <Route path="/reset-password" element={<ResetPasswordRoute />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/userapp"
        element={
          <ProtectedRoute>
            <UserAppRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consientify"
        element={
          <ProtectedRoute>
            <ConsientifyRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/builder/:folderId/:formId"
        element={
          <ProtectedRoute>
            <BuilderRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/form/:folderId/:formId"
        element={
          <ProtectedRoute>
            <FormRoute />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
