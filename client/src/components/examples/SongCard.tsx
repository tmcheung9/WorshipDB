import { SongCard } from "../SongCard";

export default function SongCardExample() {
  return (
    <div className="p-4 max-w-sm">
      <SongCard
        id="1"
        title="恩典之路"
        composer="游智婷"
        category="敬拜讚美"
        tempo="中板"
        versions={2}
        onView={() => console.log("檢視詩歌")}
        onDownload={() => console.log("下載詩歌")}
      />
    </div>
  );
}
