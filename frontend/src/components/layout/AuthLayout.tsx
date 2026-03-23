import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useOnboarding } from '@/hooks/useOnboarding';
import Onboarding from '@/components/features/Onboarding/Onboarding';

export default function AuthLayout() {
  const { user } = useAuthStore();
  const { isComplete, loading, markComplete } = useOnboarding();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isComplete === false) {
    return <Onboarding onComplete={markComplete} />;
  }

  return <Outlet />;
}
