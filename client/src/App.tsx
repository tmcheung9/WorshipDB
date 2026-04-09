import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { ProfileDialog } from "@/components/ProfileDialog";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, Upload, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import HomePage from "@/pages/HomePage";
import UploadPage from "@/pages/UploadPage";
import AdminPage from "@/pages/AdminPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";
import { ProtectedRoute, AdminRoute } from "@/components/RouteGuards";
import type { User } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/upload">
        <ProtectedRoute>
          <UploadPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <AdminRoute>
          <AdminPage />
        </AdminRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [location] = useLocation();

  const { data: syncStatus } = useQuery<any>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync/trigger");
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "同步成功",
        description: data.message || "詩歌庫已從 Google Drive 同步完成",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "同步失敗",
        description: error.message || "無法從 Google Drive 同步，請稍後再試",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      if (!user) throw new Error("Not authenticated");
      return await apiRequest("PATCH", `/api/users/${user.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setProfileDialogOpen(false);
      toast({
        title: "成功",
        description: "個人資料已更新",
      });
    },
    onError: (error: Error) => {
      console.error("Profile update error:", error);
      toast({
        title: "錯誤",
        description: error.message || "更新個人資料失敗",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "成功",
        description: "已登出",
      });
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "錯誤",
        description: "登出失敗",
        variant: "destructive",
      });
    }
  };

  const handleProfile = () => {
    setProfileDialogOpen(true);
  };

  const handleSettings = () => {
    toast({
      title: "設定功能開發中",
      description: "設定功能即將推出",
    });
  };

  const handleProfileSubmit = async (data: Partial<User>) => {
    await updateProfileMutation.mutateAsync(data);
  };

  const displayUser = user
    ? {
        name: user.firstName && user.lastName
          ? `${user.lastName}${user.firstName}`
          : (user.email && user.email.split('@')[0]) || "訪客",
        email: user.email || "未設定",
      }
    : undefined;

  const navItems = [
    {
      path: "/",
      icon: Search,
      label: "詩歌搜尋",
      tooltip: "瀏覽和搜尋詩歌庫",
      requiresAuth: false,
      requiresAdmin: false,
    },
    {
      path: "/upload",
      icon: Upload,
      label: "上傳詩歌",
      tooltip: "上傳新的詩歌檔案",
      requiresAuth: true,
      requiresAdmin: false,
    },
    {
      path: "/admin",
      icon: Shield,
      label: "後台管理",
      tooltip: "管理用戶、分類和系統設定",
      requiresAuth: true,
      requiresAdmin: true,
    },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (!item.requiresAuth) return true;
    if (!user) return false;
    if (item.requiresAdmin && user.role !== "admin") return false;
    return true;
  });

  return (
    <ThemeProvider>
      <div className="flex flex-col min-h-screen w-full">
        <header className="sticky top-0 z-10 h-16 flex items-center justify-between px-4 sm:px-6 border-b border-border/50 bg-gradient-to-r from-background via-background to-background/95 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-md rounded-lg" />
                <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-primary/90 to-primary/70">
                  <svg className="h-5 w-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hidden sm:block">
                詩歌歌曲庫
              </h1>
            </div>

            {location !== "/login" && (
              <nav className="flex items-center gap-1 ml-2">
                {visibleNavItems.map((item) => (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Link href={item.path}>
                        <Button
                          variant={location === item.path ? "default" : "ghost"}
                          size="sm"
                          className={`gap-2 transition-all ${
                            location === item.path
                              ? 'shadow-md'
                              : 'hover:bg-muted/80'
                          }`}
                          data-testid={`nav-${item.path === "/" ? "home" : item.path.slice(1)}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="hidden lg:inline text-sm">{item.label}</span>
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p>{item.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user && syncStatus && syncStatus.lastSuccess && (
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                <span>上次同步：{new Date(syncStatus.lastSuccess).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {user && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    data-testid="button-sync-header"
                    className="hidden sm:flex"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    <span className="hidden md:inline ml-1.5 text-xs">同步</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>從 Google Drive 同步詩歌庫</p>
                </TooltipContent>
              </Tooltip>
            )}
            <ThemeToggle />
            {!isLoading && (
              <UserMenu
                user={displayUser}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onProfile={handleProfile}
                onSettings={handleSettings}
              />
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background">
          <Router />
        </main>
        <SiteFooter />
      </div>

      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        user={user}
        onSubmit={handleProfileSubmit}
        isPending={updateProfileMutation.isPending}
      />
      <Toaster />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
