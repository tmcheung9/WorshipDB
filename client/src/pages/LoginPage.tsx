import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "請輸入用戶名"),
  password: z.string().min(1, "請輸入密碼"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Validate returnTo path to prevent open redirect vulnerability
function validateReturnToPath(returnTo: string): string {
  // Only allow same-origin paths (must start with /)
  // Reject URLs with protocols (http://, https://, //, etc.)
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }
  
  // Additional safety: reject if it looks like a URL
  try {
    // If it parses as a URL with a protocol, reject it
    new URL(returnTo, window.location.origin);
    // If it starts with /, it's a relative path - safe to use
    return returnTo;
  } catch {
    // If URL parsing fails, it's likely already a safe relative path
    return returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  }
}

export default function LoginPage() {
  const [location] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      return await apiRequest("POST", "/api/login", data);
    },
    onSuccess: () => {
      toast({
        title: "登入成功",
        description: "歡迎回來！",
      });
      // Navigate back to where the user came from, or to home
      // Validate returnTo to prevent open redirect vulnerability
      const returnToParam = new URLSearchParams(location.split('?')[1] || '').get('returnTo') || '/';
      const returnTo = validateReturnToPath(returnToParam);
      window.location.href = returnTo;
    },
    onError: (error: Error) => {
      console.error("Login error:", error);
      toast({
        title: "登入失敗",
        description: error.message || "用戶名或密碼錯誤",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登入</CardTitle>
          <CardDescription>輸入您的用戶名和密碼以訪問系統</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用戶名</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="admin"
                        disabled={loginMutation.isPending}
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密碼</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        disabled={loginMutation.isPending}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "登入中..." : "登入"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
