import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "請輸入詩歌名稱"),
  category: z.string().min(1, "請選擇分類"),
  bandAlbum: z.string().optional(),
  tags: z.string().optional(),
});

export type UploadFormData = z.infer<typeof formSchema>;

export interface UploadFormProps {
  fileName?: string;
  categories: string[];
  onSubmit: (data: UploadFormData) => void;
  isUploading?: boolean;
}

export function UploadForm({ fileName, categories, onSubmit, isUploading }: UploadFormProps) {
  const form = useForm<UploadFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      category: "",
      bandAlbum: "",
      tags: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {fileName && (
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">已選擇檔案：</p>
            <p className="font-medium" data-testid="text-selected-file">{fileName}</p>
          </div>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>詩歌名稱 *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="例：恩典之路"
                  data-testid="input-title"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>分類 *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="選擇詩歌分類" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bandAlbum"
            render={({ field }) => (
              <FormItem>
                <FormLabel>樂團 / 專輯</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="例：讚美之泉 - 讓愛走動"
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
                    {...field}
                    placeholder="用逗號分隔，例：敬拜,讚美"
                    data-testid="input-tags"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isUploading || !fileName}
          data-testid="button-submit-upload"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              上傳中...
            </>
          ) : (
            "上傳詩歌"
          )}
        </Button>
      </form>
    </Form>
  );
}
