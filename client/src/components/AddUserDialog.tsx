import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// Schema for creating a new user
const createUserSchema = z.object({
  username: z.string().min(3, "用戶名至少需要 3 個字元"),
  password: z.string().min(6, "密碼至少需要 6 個字元"),
  email: z.string().email("請輸入有效的電子郵件"),
  firstName: z.string().min(1, "請輸入名字"),
  lastName: z.string().min(1, "請輸入姓氏"),
  role: z.enum(["user", "admin"]),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserFormData) => void;
  isPending?: boolean;
}

export function AddUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: AddUserDialogProps) {
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
    },
  });

  const handleSubmit = (data: CreateUserFormData) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>新增使用者</DialogTitle>
          <DialogDescription>
            創建新的使用者帳號。所有欄位都是必填的。
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
                      data-testid="input-create-username"
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
                  <FormLabel>密碼</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="輸入密碼"
                      disabled={isPending}
                      data-testid="input-create-password"
                    />
                  </FormControl>
                  <FormDescription>
                    至少 6 個字元
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
                  <FormLabel>電子郵件</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="user@example.com"
                      disabled={isPending}
                      data-testid="input-create-email"
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
                        data-testid="input-create-firstname"
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
                        data-testid="input-create-lastname"
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
                    defaultValue={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-create-role">
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
                data-testid="button-cancel-create-user"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-create-user"
              >
                {isPending ? "創建中..." : "創建使用者"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
