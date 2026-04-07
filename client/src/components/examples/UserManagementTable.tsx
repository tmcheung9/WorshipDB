import { UserManagementTable, UserData } from "../UserManagementTable";

const mockUsers: UserData[] = [
  {
    id: "1",
    name: "張弟兄",
    email: "zhang@church.org",
    role: "admin",
    uploadCount: 12,
    lastActive: "2 小時前",
  },
  {
    id: "2",
    name: "李姊妹",
    email: "li@church.org",
    role: "user",
    uploadCount: 5,
    lastActive: "1 天前",
  },
  {
    id: "3",
    name: "王弟兄",
    email: "wang@church.org",
    role: "user",
    uploadCount: 8,
    lastActive: "3 小時前",
  },
];

export default function UserManagementTableExample() {
  const handleEdit = (id: string) => console.log("編輯使用者:", id);
  const handleDelete = (id: string) => console.log("刪除使用者:", id);
  const handleToggleAdmin = (id: string) => console.log("切換管理員:", id);

  return (
    <div className="p-4">
      <UserManagementTable
        users={mockUsers}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleAdmin={handleToggleAdmin}
      />
    </div>
  );
}
