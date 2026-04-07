import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@shared/schema";

const editUserSchema = z.object({
  username: z.string().min(3, "用戶名至少需要 3 個字元"),
  password: z.string().min(6, "密碼至少需要 6 個字元").optional().or(z.literal("")),
  email: z.string().email("請輸入有效的電子郵件").optional().or(z.literal("")),
  firstName: z.string().min(1, "請輸入名字"),
  lastName: z.string().min(1, "請輸入姓氏"),
  role: z.enum(["user", "admin"]),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | undefined;
  onSubmit: (id: string, data: Partial<EditUserFormData>) => void;
  isPending?: boolean;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isPending = false,
}: EditUserDialogProps) {
  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        password: "",
        email: user.email || "",
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    }
  }, [user, form]);

  const handleSubmit = (data: EditUserFormData) => {
    if (!user) return;
    
    const updateData: Partial<EditUserFormData> = {
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
    };
    
    if (data.email) {
      updateData.email = data.email;
    }
    
    if (data.password && data.password.length > 0) {
      updateData.password = data.password;
    }
    
    onSubmit(user.id, updateData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>編輯使用者</DialogTitle>
          <DialogDescription>
            更新使用者資訊。密碼欄位留空表示不修改密碼。
          </DialogDescription>
        </DialogHeader>
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
                      placeholder="輸入用戶名"
                      disabled={isPending}
                      data-testid="input-edit-username"
                    />
                  </FormControl>
                  <FormDescription>
                    用於登入系統的唯一識別名稱
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密碼（選填）</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="留空表示不修改"
                      disabled={isPending}
                      data-testid="input-edit-password"
                    />
                  </FormControl>
                  <FormDescription>
                    留空表示保持原密碼，若要修改請輸入至少 6 個字元
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電子郵件（選填）</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="user@example.com"
                      disabled={isPending}
                      data-testid="input-edit-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名字</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="輸入名字"
                        disabled={isPending}
                        data-testid="input-edit-firstname"
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
                        placeholder="輸入姓氏"
                        disabled={isPending}
                        data-testid="input-edit-lastname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-role">
                        <SelectValue placeholder="選擇角色" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">用戶</SelectItem>
                      <SelectItem value="admin">管理員</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    用戶：可瀏覽、下載、上傳和編輯 | 管理員：完整權限（包括刪除）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-edit-user"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-edit-user"
              >
                {isPending ? "更新中..." : "更新使用者"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
