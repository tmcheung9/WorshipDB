import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

const profileFormSchema = insertUserSchema
  .pick({ firstName: true, lastName: true, profileImageUrl: true })
  .partial();

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSubmit: (data: ProfileFormData) => Promise<void>;
  isPending?: boolean;
}

export function ProfileDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isPending = false,
}: ProfileDialogProps) {
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      profileImageUrl: null,
    },
  });

  // Reset form when user changes or dialog opens/closes
  useEffect(() => {
    if (open && user) {
      form.reset({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        profileImageUrl: user.profileImageUrl,
      });
    } else if (!open) {
      // Reset to defaults when dialog closes to clear stale edits
      form.reset({
        firstName: "",
        lastName: "",
        profileImageUrl: null,
      });
    }
  }, [user, form, open]);

  const handleSubmit = async (data: ProfileFormData) => {
    try {
      await onSubmit(data);
      // Dialog will close via onSuccess in parent mutation
    } catch (error) {
      console.error("Error submitting profile:", error);
      // Error toast will be shown via onError in parent mutation
      // Don't close dialog on error so user can retry
    }
  };

  const getInitials = () => {
    if (!user) return "U";
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>個人資料</DialogTitle>
          <DialogDescription>
            編輯您的個人資料與帳號資訊
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center mb-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user?.profileImageUrl ?? undefined} />
            <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
          </Avatar>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">電子郵件</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-muted"
                data-testid="input-email-readonly"
              />
              <p className="text-xs text-muted-foreground">
                電子郵件由 Replit Auth 管理，無法更改
              </p>
            </div>

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名字</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value || null)}
                      placeholder="輸入名字"
                      data-testid="input-first-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓氏</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value || null)}
                      placeholder="輸入姓氏"
                      data-testid="input-last-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profileImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>個人頭像網址</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value || null)}
                      placeholder="https://example.com/avatar.jpg"
                      data-testid="input-profile-image-url"
                    />
                  </FormControl>
                  <FormDescription>
                    輸入您的頭像圖片網址（選填）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">角色</Label>
              <Input
                value={user?.role === "admin" ? "管理員" : "用戶"}
                disabled
                className="bg-muted"
                data-testid="input-role-readonly"
              />
              <p className="text-xs text-muted-foreground">
                角色由管理員管理，無法自行更改
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-profile"
              >
                {isPending ? "儲存中..." : "儲存變更"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
