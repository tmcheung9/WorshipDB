import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UploadZone } from "@/components/UploadZone";
import { UploadForm, UploadFormData } from "@/components/UploadForm";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File>();
  const { toast } = useToast();

  // Fetch categories from API (synced from Google Drive)
  const { data: categoriesData } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/categories"],
  });

  const categories = categoriesData?.map((c) => c.name) || [];

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, data }: { file: File; data: UploadFormData }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', data.title);
      formData.append('category', data.category);
      if (data.bandAlbum) formData.append('bandAlbum', data.bandAlbum);
      if (data.tags) formData.append('tags', data.tags);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || '上傳失敗');
      }

      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "上傳成功",
        description: result.message || `詩歌「${result.song.title}」已成功上傳`,
      });
      setSelectedFile(undefined);
      // Invalidate queries to refresh the song list
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    console.log("選擇的檔案:", file.name);
  };

  const handleSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      toast({
        title: "錯誤",
        description: "請先選擇檔案",
        variant: "destructive",
      });
      return;
    }

    // Convert Chinese commas to English commas in tags
    if (data.tags) {
      data.tags = data.tags.replace(/，/g, ',');
    }

    console.log("上傳資料:", data, "檔案:", selectedFile.name);
    uploadMutation.mutate({ file: selectedFile, data });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">上傳詩歌</h1>
        <p className="text-muted-foreground">
          上傳詩歌歌譜檔案，並填寫相關資訊
        </p>
      </div>

      <UploadZone onFileSelect={handleFileSelect} />

      {selectedFile && (
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">填寫詩歌資訊</h2>
          <UploadForm
            fileName={selectedFile.name}
            categories={categories}
            onSubmit={handleSubmit}
            isUploading={uploadMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}
