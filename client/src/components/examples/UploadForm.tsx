import { useState } from "react";
import { UploadForm, UploadFormData } from "../UploadForm";

const mockCategories = ["敬拜讚美", "福音詩歌", "聖誕詩歌", "復活節詩歌"];

export default function UploadFormExample() {
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (data: UploadFormData) => {
    console.log("上傳資料:", data);
    setIsUploading(true);
    setTimeout(() => setIsUploading(false), 2000);
  };

  return (
    <div className="p-4 max-w-2xl">
      <UploadForm
        fileName="恩典之路.pdf"
        categories={mockCategories}
        onSubmit={handleSubmit}
        isUploading={isUploading}
      />
    </div>
  );
}
