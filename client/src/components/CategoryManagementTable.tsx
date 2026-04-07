import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Plus, FolderOpen, Cloud, HardDrive, Music, AlertTriangle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Category } from "@shared/schema";

interface CategoryWithSongCount extends Category {
  songCount?: number;
}

export function CategoryManagementTable() {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [cleaningCategory, setCleaningCategory] = useState<CategoryWithSongCount | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");

  const { data: categories = [], isLoading } = useQuery<CategoryWithSongCount[]>({
    queryKey: ["/api/categories"],
  });

  const { data: songs = [] } = useQuery<{ categoryId: string }[]>({
    queryKey: ["/api/songs"],
  });

  const categoriesWithCounts = categories.map(category => ({
    ...category,
    songCount: songs.filter(s => s.categoryId === category.id).length,
  }));

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/admin/categories", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCreateDialogOpen(false);
      setNewCategoryName("");
      toast({
        title: "分類已建立",
        description: "新分類已成功建立",
      });
    },
    onError: (error: any) => {
      toast({
        title: "建立失敗",
        description: error.message || "無法建立分類",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/admin/categories/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditingCategory(null);
      setEditCategoryName("");
      toast({
        title: "分類已更新",
        description: "分類名稱已成功更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "無法更新分類",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setDeletingCategory(null);
      toast({
        title: "分類已刪除",
        description: "空分類已成功刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "無法刪除分類",
        variant: "destructive",
      });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/categories/${id}/cleanup`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      setCleaningCategory(null);
      toast({
        title: "清除成功",
        description: data.message || "孤立分類及其內容已清除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "清除失敗",
        description: error.message || "無法清除孤立分類",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (newCategoryName.trim()) {
      createMutation.mutate(newCategoryName.trim());
    }
  };

  const handleUpdate = () => {
    if (editingCategory && editCategoryName.trim()) {
      updateMutation.mutate({ id: editingCategory.id, name: editCategoryName.trim() });
    }
  };

  const handleDelete = () => {
    if (deletingCategory) {
      deleteMutation.mutate(deletingCategory.id);
    }
  };

  const handleCleanup = () => {
    if (cleaningCategory) {
      cleanupMutation.mutate(cleaningCategory.id);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  const manualCategories = categoriesWithCounts.filter(c => c.isManual);
  const syncedCategories = categoriesWithCounts.filter(c => !c.isManual);
  const orphanedCategories = categoriesWithCounts.filter(c => c.isOrphaned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            共 {categories.length} 個分類（{manualCategories.length} 個手動建立，{syncedCategories.length} 個來自 Google Drive）
            {orphanedCategories.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">
                （{orphanedCategories.length} 個孤立分類需要清除）
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="button-create-category"
        >
          <Plus className="h-4 w-4 mr-2" />
          新增分類
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>分類名稱</TableHead>
              <TableHead>來源</TableHead>
              <TableHead>歌曲數量</TableHead>
              <TableHead>最後同步</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoriesWithCounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  尚無分類資料
                </TableCell>
              </TableRow>
            ) : (
              categoriesWithCounts.map((category) => (
                <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {category.isManual ? (
                        <Badge variant="secondary" className="gap-1">
                          <HardDrive className="h-3 w-3" />
                          手動建立
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Cloud className="h-3 w-3" />
                          Google Drive
                        </Badge>
                      )}
                      {category.isOrphaned && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          已失效
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Music className="h-3 w-3" />
                      {category.songCount || 0} 首
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {category.lastSynced
                      ? new Date(category.lastSynced).toLocaleDateString("zh-TW", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(category)}
                        data-testid={`button-edit-category-${category.id}`}
                        title="編輯分類"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {category.isOrphaned && (category.songCount || 0) > 0 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCleaningCategory(category)}
                          data-testid={`button-cleanup-category-${category.id}`}
                          title="清除孤立分類及其所有歌曲"
                          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingCategory(category)}
                          data-testid={`button-delete-category-${category.id}`}
                          title={(category.songCount || 0) > 0 ? "此分類包含歌曲，無法刪除" : "刪除分類"}
                          disabled={(category.songCount || 0) > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增分類</DialogTitle>
            <DialogDescription>
              手動建立的分類不會受到 Google Drive 同步影響
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="輸入分類名稱"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              data-testid="input-new-category-name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewCategoryName("");
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newCategoryName.trim() || createMutation.isPending}
              data-testid="button-confirm-create-category"
            >
              {createMutation.isPending ? "建立中..." : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯分類</DialogTitle>
            <DialogDescription>
              {editingCategory?.isManual
                ? "修改手動建立的分類名稱"
                : "注意：此分類來自 Google Drive，下次同步時可能會被覆蓋"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="輸入分類名稱"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              data-testid="input-edit-category-name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdate();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingCategory(null);
                setEditCategoryName("");
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!editCategoryName.trim() || updateMutation.isPending}
              data-testid="button-confirm-edit-category"
            >
              {updateMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此分類？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory && (
                <>
                  您即將刪除分類「{deletingCategory.name}」
                  {!deletingCategory.isManual && deletingCategory.driveId && (
                    <span className="block mt-2 text-muted-foreground">
                      注意：此為 Google Drive 同步分類。刪除後，若資料夾仍存在於 Drive 中，下次同步時會重新建立。
                    </span>
                  )}
                  <span className="block mt-2">此操作無法復原。</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-category"
            >
              {deleteMutation.isPending ? "刪除中..." : "確定刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cleaningCategory} onOpenChange={(open) => !open && setCleaningCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              清除孤立分類
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {cleaningCategory && (
                  <>
                    <p>
                      分類「{cleaningCategory.name}」的 Google Drive 資料夾已無法存取。
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      即將刪除的內容：
                    </p>
                    <ul className="mt-1 list-disc list-inside text-muted-foreground">
                      <li>{cleaningCategory.songCount || 0} 首詩歌</li>
                      <li>所有相關檔案</li>
                      <li>此分類本身</li>
                    </ul>
                    <p className="mt-3 text-destructive font-medium">
                      此操作無法復原！請確認您要清除此孤立分類及其所有內容。
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              className="bg-amber-600 text-white hover:bg-amber-700"
              data-testid="button-confirm-cleanup-category"
            >
              {cleanupMutation.isPending ? "清除中..." : "確定清除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
