import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Song } from "@shared/schema";

const editSongSchema = z.object({
  title: z.string().min(1, "請輸入詩歌名稱"),
  categoryId: z.string().min(1, "請選擇分類"),
  bandAlbum: z.string().optional(),
  tags: z.array(z.string()),
});

type EditSongFormData = z.infer<typeof editSongSchema>;

interface EditSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: Song | null;
  categories: { id: string; name: string }[];
  onSubmit: (data: { title: string; categoryId: string; tags: string[]; bandAlbum?: string | null }) => Promise<void>;
  isPending?: boolean;
}

export function EditSongDialog({
  open,
  onOpenChange,
  song,
  categories,
  onSubmit,
  isPending = false,
}: EditSongDialogProps) {
  const [tagsInputValue, setTagsInputValue] = useState("");

  const form = useForm<EditSongFormData>({
    resolver: zodResolver(editSongSchema),
    defaultValues: {
      title: "",
      categoryId: "",
      bandAlbum: undefined,
      tags: [],
    },
  });

  useEffect(() => {
    if (song && open) {
      form.reset({
        title: song.title,
        categoryId: song.categoryId,
        bandAlbum: song.bandAlbum || undefined,
        tags: song.tags || [],
      });
      setTagsInputValue(song.tags?.join(", ") || "");
    }
  }, [song, open, form]);

  const handleSubmit = async (data: EditSongFormData) => {
    await onSubmit(data);
  };

  const handleTagsChange = (value: string) => {
    setTagsInputValue(value);
    const tagsArray = value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    form.setValue("tags", tagsArray);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>編輯詩歌資料</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詩歌名稱</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="輸入詩歌名稱"
                      data-testid="input-edit-song-title"
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
                  <FormLabel>分類</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-category">
                        <SelectValue placeholder="選擇分類" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          data-testid={`edit-category-option-${category.id}`}
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

            <FormField
              control={form.control}
              name="bandAlbum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>樂團/專輯</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      placeholder="例如：SEMM、基恩、ACM"
                      data-testid="input-edit-band-album"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>標籤</FormLabel>
              <FormControl>
                <Input
                  value={tagsInputValue}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  placeholder="以逗號分隔，例如：敬拜, 感恩, 禱告"
                  data-testid="input-edit-tags"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                以逗號分隔多個標籤
              </p>
            </FormItem>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-edit">
                {isPending ? "儲存中..." : "儲存變更"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
