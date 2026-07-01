import { useNavigate, useSearchParams } from "react-router-dom";
import Register from "../../pages/Register";
import ForgotPassword from "../../pages/ForgotPassword";
import ResetPassword from "../../pages/ResetPassword";

export function RegisterRoute() {
  const navigate = useNavigate();
  return <Register onBackToLogin={() => navigate("/login")} />;
}

export function ForgotPasswordRoute() {
  const navigate = useNavigate();
  return <ForgotPassword onBackToLogin={() => navigate("/login")} />;
}

export function ResetPasswordRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  return (
    <ResetPassword
      token={token}
      onBackToLogin={() => navigate("/login", { replace: true })}
    />
  );
}
