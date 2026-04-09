import { useState, useMemo, useEffect } from "react";
import { AdminTable, SongData } from "@/components/AdminTable";
import { UserManagementTable, UserData } from "@/components/UserManagementTable";
import { CategoryManagementTable } from "@/components/CategoryManagementTable";
import { AddEditSongDialog } from "@/components/AddEditSongDialog";
import { AddUserDialog } from "@/components/AddUserDialog";
import { EditUserDialog } from "@/components/EditUserDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Users, Upload, Database, Plus, RefreshCw, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Clock, FolderOpen, Sparkles, Tags, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Song, Category, File as FileRecord, User } from "@shared/schema";
import { insertSongSchema } from "@shared/schema";
import { z } from "zod";

const songFormSchema = insertSongSchema.omit({ uploadedBy: true });
type SongFormData = z.infer<typeof songFormSchema>;

export default function AdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("songs");
  const [songDialogOpen, setSongDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | undefined>(undefined);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [adminSongSearch, setAdminSongSearch] = useState("");
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [sortColumn, setSortColumn] = useState<string>("title");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const { data: songs = [] } = useQuery<Song[]>({
    queryKey: ["/api/songs"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: files = [] } = useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const { data: syncStatus } = useQuery<any>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/sync/trigger", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
      toast({
        title: data.success ? "同步完成" : "同步失敗",
        description: data.message || "已從 Google Drive 同步最新資料",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
      toast({
        title: "同步失敗",
        description: error.message || "無法從 Google Drive 同步資料",
        variant: "destructive",
      });
    },
  });

  const extractBandAlbumMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/songs/extract-band-album", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/all-for-filters"] });
      toast({
        title: "自動填入完成",
        description: data.message || `已更新 ${data.stats?.updated || 0} 首詩歌`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "自動填入失敗",
        description: error.message || "無法自動填入樂團/專輯資訊",
        variant: "destructive",
      });
    },
  });

  const aiGenerateTagsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/songs/ai-generate-tags", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/all-for-filters"] });
      toast({
        title: "AI 標籤生成完成",
        description: data.message || `AI 已為 ${data.stats?.updated || 0} 首詩歌生成標籤`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "AI 標籤生成失敗",
        description: error.message || "無法使用 AI 生成標籤",
        variant: "destructive",
      });
    },
  });

  const songData = useMemo<SongData[]>(() => {
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const fileCountMap = new Map<string, number>();
    
    files.forEach(file => {
      fileCountMap.set(file.songId, (fileCountMap.get(file.songId) || 0) + 1);
    });

    return songs.map(song => ({
      ...song,
      categoryName: song.categoryId ? categoryMap.get(song.categoryId) : undefined,
      fileCount: fileCountMap.get(song.id) || 0,
    }));
  }, [songs, categories, files]);

  const filteredSongData = useMemo(() => {
    if (!adminSongSearch.trim()) return songData;
    const searchLower = adminSongSearch.toLowerCase().trim();
    return songData.filter(song =>
      song.title.toLowerCase().includes(searchLower) ||
      song.bandAlbum?.toLowerCase().includes(searchLower) ||
      song.categoryName?.toLowerCase().includes(searchLower) ||
      song.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }, [songData, adminSongSearch]);

  const sortedSongData = useMemo(() => {
    const sorted = [...filteredSongData].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '', 'zh-TW');
          break;
        case 'categoryName':
          comparison = (a.categoryName || '').localeCompare(b.categoryName || '', 'zh-TW');
          break;
        case 'bandAlbum':
          comparison = (a.bandAlbum || '').localeCompare(b.bandAlbum || '', 'zh-TW');
          break;
        case 'fileCount':
          comparison = (a.fileCount || 0) - (b.fileCount || 0);
          break;
        default:
          return 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredSongData, sortColumn, sortDirection]);

  const paginatedSongData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedSongData.slice(startIndex, startIndex + pageSize);
  }, [sortedSongData, currentPage, pageSize]);

  const addSongMutation = useMutation({
    mutationFn: async ({ data, file }: { data: SongFormData; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', data.title);
      formData.append('category', categories.find(c => c.id === data.categoryId)?.name || '');
      if (data.bandAlbum) formData.append('bandAlbum', data.bandAlbum);
      if (data.tags && data.tags.length > 0) formData.append('tags', data.tags.join(','));

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/all-for-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/fallback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setSongDialogOpen(false);
      toast({
        title: "成功",
        description: "詩歌已新增",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "新增詩歌失敗",
        variant: "destructive",
      });
    },
  });

  const editSongMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SongFormData }) => {
      return await apiRequest("PATCH", `/api/songs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/all-for-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/fallback"] });
      toast({
        title: "成功",
        description: "詩歌已更新",
      });
    },
    onError: () => {
      toast({
        title: "錯誤",
        description: "更新詩歌失敗",
        variant: "destructive",
      });
    },
  });

  const deleteSongMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/songs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/all-for-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/fallback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "成功",
        description: "詩歌已刪除",
      });
    },
    onError: () => {
      toast({
        title: "錯誤",
        description: "刪除詩歌失敗",
        variant: "destructive",
      });
    },
  });

  const handleView = (id: string) => {
    const song = songs.find(s => s.id === id);
    const songFiles = files.filter(f => f.songId === id);
    console.log("檢視詩歌:", { song, files: songFiles });
    toast({
      title: "檢視詩歌",
      description: `${song?.title} - 共 ${songFiles.length} 個檔案`,
    });
  };

  const handleEdit = (id: string) => {
    const song = songs.find(s => s.id === id);
    if (song) {
      setEditingSong(song);
      setSongDialogOpen(true);
    }
  };

  const handleAddSong = () => {
    setEditingSong(undefined);
    setSongDialogOpen(true);
  };

  const handleSongSubmit = async (data: SongFormData, file?: File) => {
    if (data.tags && Array.isArray(data.tags)) {
      data.tags = data.tags.map(tag => tag.replace(/，/g, ','));
    }
    
    if (editingSong) {
      await editSongMutation.mutateAsync({ id: editingSong.id, data });
    } else {
      if (!file) {
        toast({
          title: "錯誤",
          description: "請選擇要上傳的檔案",
          variant: "destructive",
        });
        return;
      }
      await addSongMutation.mutateAsync({ data, file });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("確定要刪除這首詩歌嗎？這將同時刪除所有相關檔案。")) {
      deleteSongMutation.mutate(id);
    }
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialogOpen(false);
      toast({
        title: "成功",
        description: "使用者已創建",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "創建使用者失敗",
        variant: "destructive",
      });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUserDialogOpen(false);
      toast({
        title: "成功",
        description: "使用者已更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "更新使用者失敗",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "成功",
        description: "使用者已刪除",
      });
    },
    onError: () => {
      toast({
        title: "錯誤",
        description: "刪除使用者失敗",
        variant: "destructive",
      });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return await apiRequest("PATCH", `/api/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "成功",
        description: "權限已更新",
      });
    },
    onError: () => {
      toast({
        title: "錯誤",
        description: "更新權限失敗",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (user) {
      setEditingUser(user);
      setEditUserDialogOpen(true);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (confirm("確定要刪除這個使用者嗎？此操作無法復原。")) {
      deleteUserMutation.mutate(id);
    }
  };

  const handleToggleAdmin = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const newRole = user.role === "admin" ? "user" : "admin";
    const action = newRole === "admin" ? "設為管理員" : "移除管理員權限";
    
    if (confirm(`確定要${action}嗎？`)) {
      toggleAdminMutation.mutate({ id, role: newRole });
    }
  };

  const handleAddUser = () => {
    setUserDialogOpen(true);
  };

  const handleUserSubmit = (data: any) => {
    createUserMutation.mutate(data);
  };

  const handleEditUserSubmit = (id: string, data: any) => {
    editUserMutation.mutate({ id, data });
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [adminSongSearch]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">後台管理</h1>
          <p className="text-muted-foreground text-lg">管理詩歌庫存、使用者帳號與系統設定</p>
          
          {syncStatus && syncStatus.initialized && (
            <>
              {syncStatus.isPaused && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    同步已暫停（{syncStatus.consecutiveFailures} 次連續失敗）。
                    請修復問題後使用右側按鈕手動觸發同步。
                  </AlertDescription>
                </Alert>
              )}
              {!syncStatus.isPaused && syncStatus.cooldownUntil && new Date(syncStatus.cooldownUntil) > new Date() && (
                <Alert className="mt-4">
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    {syncStatus.statusMessage || "同步冷卻中"}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          data-testid="button-sync-drive"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? '同步中...' : '同步 Google Drive'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="hover-elevate transition-all duration-200 border-border/50 shadow-sm hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">總詩歌數</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10">
              <Music className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="stat-total-songs">{songs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">已收錄詩歌</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all duration-200 border-border/50 shadow-sm hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">總檔案數</CardTitle>
            <div className="p-2 rounded-lg bg-accent/10">
              <Upload className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="stat-total-files">{files.length}</div>
            <p className="text-xs text-muted-foreground mt-1">PDF 與圖片檔案</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all duration-200 border-border/50 shadow-sm hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">分類數量</CardTitle>
            <div className="p-2 rounded-lg bg-secondary/50">
              <Database className="h-4 w-4 text-secondary-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="stat-categories">{categories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Google Drive 資料夾</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all duration-200 border-border/50 shadow-sm hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">使用者數</CardTitle>
            <div className="p-2 rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="stat-users">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">已註冊使用者</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all duration-200 border-border/50 shadow-sm hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">同步狀態</CardTitle>
            <div className={`p-2 rounded-lg ${syncStatus?.initialized && syncStatus?.lastSuccess ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
              {syncStatus?.initialized && syncStatus?.lastSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground" data-testid="sync-status">
              {!syncStatus?.initialized && "尚未同步"}
              {syncStatus?.initialized && syncStatus?.isPaused && "已暫停"}
              {syncStatus?.initialized && !syncStatus?.isPaused && syncStatus?.lastSuccess && "正常"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {syncStatus?.lastSuccess 
                ? `上次: ${new Date(syncStatus.lastSuccess).toLocaleString('zh-TW')}`
                : "等待首次同步"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="songs" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg" data-testid="tab-songs">
              <Music className="h-4 w-4 mr-2" />
              詩歌管理
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg" data-testid="tab-categories">
              <FolderOpen className="h-4 w-4 mr-2" />
              分類管理
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              使用者管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="songs" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">詩歌列表</h2>
                <p className="text-sm text-muted-foreground">
                  {sortedSongData.length > pageSize ? (
                    <>
                      第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedSongData.length)} 首，
                      共 {sortedSongData.length} 首詩歌
                      {adminSongSearch && ` (從 ${songData.length} 首中篩選)`}
                    </>
                  ) : (
                    adminSongSearch ? `找到 ${filteredSongData.length} / ${songData.length} 首詩歌` : `共 ${songData.length} 首詩歌`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => extractBandAlbumMutation.mutate()}
                  disabled={extractBandAlbumMutation.isPending}
                  className="border-border/50"
                  data-testid="button-extract-band-album"
                >
                  <Sparkles className={`h-4 w-4 mr-2 ${extractBandAlbumMutation.isPending ? 'animate-pulse' : ''}`} />
                  {extractBandAlbumMutation.isPending ? '填入中...' : '自動填入樂團/專輯'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => aiGenerateTagsMutation.mutate()}
                  disabled={aiGenerateTagsMutation.isPending}
                  className="border-border/50"
                  data-testid="button-ai-generate-tags"
                  title="使用 AI 生成標籤（需要 Gemini API Key）"
                >
                  <Tags className={`h-4 w-4 mr-2 ${aiGenerateTagsMutation.isPending ? 'animate-pulse' : ''}`} />
                  {aiGenerateTagsMutation.isPending ? 'AI 生成中...' : 'AI 生成標籤'}
                </Button>
                <Button
                  onClick={handleAddSong}
                  className="bg-primary hover:bg-primary/90 shadow-md"
                  data-testid="button-add-song"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  新增詩歌
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜尋詩歌名稱、樂團/專輯、分類或標籤..."
                value={adminSongSearch}
                onChange={(e) => setAdminSongSearch(e.target.value)}
                className="pl-10 pr-10 h-10 border-border/50 bg-background shadow-sm focus:shadow-md transition-shadow"
                data-testid="input-admin-song-search"
              />
              {adminSongSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setAdminSongSearch("")}
                  data-testid="button-clear-admin-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <AdminTable
              songs={paginatedSongData}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={sortedSongData.length}
              onPageChange={handlePageChange}
            />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">分類管理</h2>
              <p className="text-muted-foreground text-sm">管理歌曲分類，可手動建立或由 Google Drive 自動同步</p>
            </div>
            <CategoryManagementTable />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">使用者列表</h2>
                <p className="text-muted-foreground text-sm">管理系統使用者與權限</p>
              </div>
              <Button onClick={handleAddUser} className="bg-primary hover:bg-primary/90 shadow-md" data-testid="button-add-user">
                <Plus className="h-4 w-4 mr-2" />
                新增使用者
              </Button>
            </div>

            <UserManagementTable
              users={users.map(user => ({
                id: user.id,
                name: `${user.lastName}${user.firstName}`,
                email: user.email || "",
                role: user.role === "admin" ? "admin" : "user",
                avatar: user.profileImageUrl || undefined,
                uploadCount: 0,
                lastActive: undefined,
              }))}
              onEdit={handleEditUser}
              onDelete={handleDeleteUser}
              onToggleAdmin={handleToggleAdmin}
            />
          </TabsContent>
      </Tabs>

      <AddEditSongDialog
        open={songDialogOpen}
        onOpenChange={setSongDialogOpen}
        song={editingSong}
        categories={categories}
        onSubmit={handleSongSubmit}
        isPending={addSongMutation.isPending || editSongMutation.isPending}
      />

      <AddUserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        onSubmit={handleUserSubmit}
        isPending={createUserMutation.isPending}
      />

      <EditUserDialog
        open={editUserDialogOpen}
        onOpenChange={setEditUserDialogOpen}
        user={editingUser}
        onSubmit={handleEditUserSubmit}
        isPending={editUserMutation.isPending}
      />
    </div>
  );
}
