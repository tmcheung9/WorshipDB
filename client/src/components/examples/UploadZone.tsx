import { UploadZone } from "../UploadZone";

export default function UploadZoneExample() {
  const handleFileSelect = (file: File) => {
    console.log("選擇的檔案:", file.name);
  };

  return (
    <div className="p-4 max-w-2xl">
      <UploadZone onFileSelect={handleFileSelect} />
    </div>
  );
}
