import { AdminTable, SongData } from "../AdminTable";

const mockSongs: SongData[] = [
  {
    id: "1",
    title: "恩典之路",
    composer: "游智婷",
    category: "敬拜讚美",
    tempo: "中板",
    versions: 2,
    uploadedBy: "張弟兄",
  },
  {
    id: "2",
    title: "奇異恩典",
    composer: "約翰·牛頓",
    category: "福音詩歌",
    tempo: "慢板",
    versions: 1,
    uploadedBy: "李姊妹",
  },
  {
    id: "3",
    title: "讚美之泉",
    composer: "游智婷",
    category: "敬拜讚美",
    tempo: "快板",
    versions: 3,
    uploadedBy: "王弟兄",
  },
];

export default function AdminTableExample() {
  const handleView = (id: string) => console.log("檢視:", id);
  const handleEdit = (id: string) => console.log("編輯:", id);
  const handleDelete = (id: string) => console.log("刪除:", id);

  return (
    <div className="p-4">
      <AdminTable
        songs={mockSongs}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
