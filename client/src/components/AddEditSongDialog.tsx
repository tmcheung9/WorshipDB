import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSongSchema } from "@shared/schema";
import type { Song, Category } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Upload, FileText, X } from "lucide-react";

const songFormSchema = insertSongSchema.omit({ uploadedBy: true });
type SongFormData = z.infer<typeof songFormSchema>;

interface AddEditSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song?: Song;
  categories: Category[];
  onSubmit: (data: SongFormData, file?: File) => Promise<void>;
  isPending?: boolean;
}

export function AddEditSongDialog({
  open,
  onOpenChange,
  song,
  categories,
  onSubmit,
  isPending = false,
}: AddEditSongDialogProps) {
  const isEdit = !!song;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [tagsInputValue, setTagsInputValue] = useState<string>("");

  const form = useForm<SongFormData>({
    resolver: zodResolver(songFormSchema),
    defaultValues: {
      title: "",
      categoryId: "",
      bandAlbum: null,
      tags: [],
    },
  });

  // Reset form when song changes or dialog opens/closes
  useEffect(() => {
    if (song && isEdit) {
      form.reset({
        title: song.title,
        categoryId: song.categoryId,
        bandAlbum: song.bandAlbum,
        tags: song.tags || [],
      });
      setTagsInputValue(song.tags?.join(', ') || "");
    } else if (!song && !isEdit) {
      form.reset({
        title: "",
        categoryId: "",
        bandAlbum: null,
        tags: [],
      });
      setTagsInputValue("");
      setSelectedFile(null);
      setFileError("");
    }
  }, [song, isEdit, form, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        setFileError("請選擇 PDF 或圖片檔案（JPG、PNG）");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setFileError("");
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError("");
  };

  const handleSubmit = async (data: SongFormData) => {
    try {
      // For new songs, file is required
      if (!isEdit && !selectedFile) {
        setFileError("請選擇要上傳的檔案");
        return;
      }

      await onSubmit(data, selectedFile || undefined);
      onOpenChange(false);
      form.reset();
      setSelectedFile(null);
      setFileError("");
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯詩歌" : "新增詩歌"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "修改詩歌的基本資訊和元數據"
              : "新增一首詩歌到歌曲庫"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詩歌名稱 *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="輸入詩歌名稱"
                      data-testid="input-song-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分類 *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="選擇分類" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          data-testid={`category-option-${category.id}`}
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File upload section - only for new songs */}
            {!isEdit && (
              <div className="space-y-2">
                <Label>
                  檔案上傳 <span className="text-destructive">*</span>
                </Label>
                <div className="border-2 border-dashed rounded-lg p-6 space-y-3">
                  {!selectedFile ? (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="rounded-full bg-primary/10 p-4">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">選擇歌譜檔案</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          支援 PDF、JPG、PNG 格式
                        </p>
                      </div>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                        data-testid="input-file"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {fileError && (
                  <p className="text-sm text-destructive" data-testid="file-error">
                    {fileError}
                  </p>
                )}
                <FormDescription>
                  上傳詩歌的歌譜檔案（PDF 或圖片格式）
                </FormDescription>
              </div>
            )}

            <FormField
              control={form.control}
              name="bandAlbum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>樂團 / 專輯</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value || null)}
                      placeholder="輸入樂團或專輯名稱"
                      data-testid="input-band-album"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>標籤</FormLabel>
                  <FormControl>
                    <Input
                      value={tagsInputValue}
                      onChange={e => {
                        setTagsInputValue(e.target.value);
                      }}
                      onBlur={() => {
                        const tagsString = tagsInputValue.replace(/，/g, ',');
                        const tagArray = tagsString
                          .split(',')
                          .map((tag: string) => tag.trim())
                          .filter((tag: string) => tag.length > 0);
                        field.onChange(tagArray.length > 0 ? tagArray : null);
                        setTagsInputValue(tagArray.length > 0 ? tagArray.join(', ') : "");
                      }}
                      placeholder="用逗號分隔標籤，例：敬拜,讚美,經典"
                      data-testid="input-tags"
                    />
                  </FormControl>
                  <FormDescription>
                    用逗號分隔多個標籤，便於分類和搜尋
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit"
              >
                {isPending ? "處理中..." : isEdit ? "儲存變更" : "新增詩歌"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
