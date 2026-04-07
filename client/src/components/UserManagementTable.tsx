import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Shield, ShieldOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  avatar?: string;
  uploadCount: number;
  lastActive?: string;
}

export interface UserManagementTableProps {
  users: UserData[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleAdmin?: (id: string) => void;
}

export function UserManagementTable({ 
  users, 
  onEdit, 
  onDelete, 
  onToggleAdmin 
}: UserManagementTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>使用者</TableHead>
            <TableHead>電子郵件</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>上傳數量</TableHead>
            <TableHead>最後活動</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                尚無使用者資料
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const initials = user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                      data-testid={`badge-role-${user.id}`}
                    >
                      {user.role === "admin" ? "管理員" : "一般使用者"}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.uploadCount} 首</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastActive || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleAdmin?.(user.id)}
                        data-testid={`button-toggle-admin-${user.id}`}
                        title={user.role === "admin" ? "移除管理員" : "設為管理員"}
                      >
                        {user.role === "admin" ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit?.(user.id)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete?.(user.id)}
                        data-testid={`button-delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
