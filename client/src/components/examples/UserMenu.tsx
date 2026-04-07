import { UserMenu } from "../UserMenu";

export default function UserMenuExample() {
  const mockUser = {
    name: "張弟兄",
    email: "zhang@church.org",
  };

  return (
    <div className="p-4 flex justify-end">
      <UserMenu
        user={mockUser}
        onLogin={() => console.log("登入")}
        onLogout={() => console.log("登出")}
        onProfile={() => console.log("個人資料")}
        onSettings={() => console.log("設定")}
      />
    </div>
  );
}
