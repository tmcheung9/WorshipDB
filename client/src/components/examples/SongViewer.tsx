import { SongViewer, Song } from "../SongViewer";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const mockSongs: Song[] = [
  {
    id: "1",
    title: "恩典之路",
    category: "敬拜讚美",
    composer: "游智婷",
  },
  {
    id: "2",
    title: "奇異恩典",
    category: "福音詩歌",
    composer: "約翰·牛頓",
  },
  {
    id: "3",
    title: "讚美之泉",
    category: "敬拜讚美",
    composer: "游智婷",
  },
];

export default function SongViewerExample() {
  const [showViewer, setShowViewer] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setShowViewer(true)}>
        開啟詩歌檢視器
      </Button>

      {showViewer && (
        <SongViewer
          songs={mockSongs}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
}
