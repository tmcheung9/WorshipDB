import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Image, Music } from "lucide-react";
import { useState, useEffect } from "react";

export interface SongFile {
  id: string;
  name: string;
  type: "pdf" | "image" | "other";
  url?: string;
  size?: string;
  uploadedAt?: string;
}

export interface SongWithFiles {
  id: string;
  title: string;
  category?: string;
  bandAlbum?: string;
  files: SongFile[];
}

export interface FileSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songs: SongWithFiles[];
  onConfirm: (selectedFiles: { songId: string; fileId: string }[]) => void;
}

export function FileSelectionDialog({
  open,
  onOpenChange,
  songs,
  onConfirm,
}: FileSelectionDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<
    { songId: string; fileId: string }[]
  >([]);

  // Reset selected files when dialog opens or songs change
  // This ensures fresh selection state when opening the dialog with different songs
  useEffect(() => {
    if (open) {
      // Reset to empty when dialog opens - user must select files fresh each time
      setSelectedFiles([]);
    }
  }, [open, songs]);

  const handleToggleFile = (songId: string, fileId: string) => {
    setSelectedFiles((prev) => {
      const exists = prev.some(
        (f) => f.songId === songId && f.fileId === fileId
      );
      if (exists) {
        return prev.filter(
          (f) => !(f.songId === songId && f.fileId === fileId)
        );
      } else {
        return [...prev, { songId, fileId }];
      }
    });
  };

  const isFileSelected = (songId: string, fileId: string) => {
    return selectedFiles.some(
      (f) => f.songId === songId && f.fileId === fileId
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedFiles);
    onOpenChange(false);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      default:
        return <Music className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>選擇要預覽的檔案</DialogTitle>
          <DialogDescription>
            選擇您想要在多標籤檢視器中開啟的檔案
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {songs.map((song) => (
              <div key={song.id} className="space-y-3">
                <div className="sticky top-0 bg-background py-2 border-b">
                  <h3 className="font-semibold text-base">{song.title}</h3>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    {song.bandAlbum && <span>樂團/專輯：{song.bandAlbum}</span>}
                    {song.category && <span>• 分類：{song.category}</span>}
                  </div>
                </div>

                <div className="space-y-2 pl-2">
                  {song.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover-elevate cursor-pointer"
                      onClick={() => handleToggleFile(song.id, file.id)}
                      data-testid={`file-item-${file.id}`}
                    >
                      <Checkbox
                        checked={isFileSelected(song.id, file.id)}
                        onCheckedChange={() =>
                          handleToggleFile(song.id, file.id)
                        }
                        data-testid={`checkbox-file-${file.id}`}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        {getFileIcon(file.type)}
                        <span className="font-medium">{file.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {file.type.toUpperCase()}
                        </Badge>
                        {file.size && (
                          <span className="text-xs text-muted-foreground">
                            {file.size}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              已選擇 {selectedFiles.length} 個檔案
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-selection"
              >
                取消
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedFiles.length === 0}
                data-testid="button-confirm-selection"
              >
                預覽選擇的檔案
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
