import { useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFileType(file.type)) {
      onFileSelect(file);
    }
  };

  const isValidFileType = (type: string) => {
    return (
      type === "application/pdf" ||
      type.startsWith("image/")
    );
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-12
        flex flex-col items-center justify-center
        transition-colors
        ${isDragging ? "border-primary bg-primary/5" : "border-border"}
      `}
      data-testid="dropzone-upload"
    >
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">拖放檔案至此</h3>
      <p className="text-sm text-muted-foreground mb-4">或點擊下方按鈕選擇檔案</p>
      <Button variant="outline" asChild data-testid="button-browse-files">
        <label>
          瀏覽檔案
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      </Button>
      <p className="text-xs text-muted-foreground mt-4">支援 PDF 及圖片格式（JPG、PNG、GIF 等）</p>
    </div>
  );
}
