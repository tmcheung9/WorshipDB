import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface GuardProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: GuardProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate(`/login?returnTo=${encodeURIComponent(location)}`);
    }
  }, [isLoading, user, location, navigate]);

  if (isLoading) return null;
  if (!user) return null;

  return <>{children}</>;
}

export function AdminRoute({ children }: GuardProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login?returnTo=/admin");
    } else if (!isLoading && user && user.role !== "admin") {
      toast({
        title: "存取被拒絕",
        description: "您沒有權限存取後台管理功能",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isLoading, user, navigate, toast]);

  if (isLoading) return null;
  if (!user || user.role !== "admin") return null;

  return <>{children}</>;
}
