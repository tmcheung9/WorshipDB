import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel } from "@/components/FilterPanel";
import { SongCard } from "@/components/SongCard";
import { SongListItem } from "@/components/SongListItem";
import { SongViewer, FilePreview } from "@/components/SongViewer";
import { FileSelectionDialog, SongWithFiles } from "@/components/FileSelectionDialog";
import { EditSongDialog } from "@/components/EditSongDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, ChevronUp, Eye, X, Grid3x3, List, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Song, Category } from "@shared/schema";

// Real data fetched from API (Google Drive)

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBandAlbum, setSelectedBandAlbum] = useState<string>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<FilePreview[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  const canEdit = isAuthenticated && (user?.role === "admin" || user?.role === "uploader");

  // Fetch sync status for initialization warning
  const { data: syncStatus } = useQuery<any>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch categories from API (synced from Google Drive)
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/categories"],
  });

  // Get category ID from selected category name
  const selectedCategoryId = selectedCategory && selectedCategory !== "all" 
    ? categoriesData?.find(c => c.name === selectedCategory)?.id 
    : undefined;

  // Fetch songs from API with search/filter
  const { data: songsData, isLoading: songsLoading } = useQuery<Array<{
    id: string;
    title: string;
    categoryId: string;
    bandAlbum: string | null;
    tags: string[] | null;
  }>>({
    queryKey: ["/api/songs", search, selectedCategoryId, selectedBandAlbum, selectedTags],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) {
        params.append("search", search);
      }
      if (selectedCategoryId) {
        params.append("categoryId", selectedCategoryId);
      }
      if (selectedBandAlbum) {
        params.append("bandAlbum", selectedBandAlbum);
      }
      if (selectedTags.length > 0) {
        selectedTags.forEach(tag => params.append("tags", tag));
      }
      const url = `/api/songs${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch songs");
      return response.json();
    },
    enabled: !!categoriesData,
  });

  // Always fetch all songs in category as fallback (for when search returns no results)
  const { data: allSongsInCategory } = useQuery<Array<{
    id: string;
    title: string;
    categoryId: string;
    bandAlbum: string | null;
    tags: string[] | null;
  }>>({
    queryKey: ["/api/songs/fallback", selectedCategoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategoryId) {
        params.append("categoryId", selectedCategoryId);
      }
      const response = await fetch(`/api/songs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch fallback songs");
      return response.json();
    },
    enabled: !!categoriesData && (songsData?.length === 0 || false),
  });

  // Fetch files for songs
  const { data: filesData } = useQuery<Array<{
    id: string;
    songId: string;
    name: string;
    driveId: string;
    mimeType: string;
    size: number | null;
    webViewLink: string | null;
  }>>({
    queryKey: ["/api/files"],
    enabled: !!songsData,
  });
  
  // Helper function to format file size
  const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined) return ''; // Unknown size - hide label
    if (bytes === 0) return '< 1 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Fetch ALL songs (without filters) to extract available filter options
  const { data: allSongsForFilters } = useQuery<Array<{
    id: string;
    title: string;
    categoryId: string;
    bandAlbum: string | null;
    tags: string[] | null;
  }>>({
    queryKey: ["/api/songs/all-for-filters"],
    queryFn: async () => {
      const response = await fetch("/api/songs");
      if (!response.ok) throw new Error("Failed to fetch all songs");
      return response.json();
    },
    enabled: !!categoriesData,
  });

  const categories = categoriesData?.map((c) => c.name) || [];
  
  // Map category IDs to names
  const categoryMap = new Map(categoriesData?.map(c => [c.id, c.name]) || []);
  
  // Filter songs based on selected category for bandAlbum/tag options
  // This ensures the dropdown only shows options that exist in the current category
  const songsForFilterOptions = selectedCategoryId 
    ? allSongsForFilters?.filter(s => s.categoryId === selectedCategoryId) 
    : allSongsForFilters;
  
  // Extract unique metadata values - filtered by category if one is selected
  const bandAlbums = Array.from(new Set(songsForFilterOptions?.map(s => s.bandAlbum).filter(Boolean) || [])) as string[];
  
  // Extract unique tags - filtered by category if one is selected
  const allTags = Array.from(
    new Set(
      songsForFilterOptions?.flatMap(s => s.tags || []).filter(Boolean) || []
    )
  ) as string[];
  
  // Clear selected bandAlbum and tags if they're no longer valid after category change
  useEffect(() => {
    // Clear bandAlbum if it's not available in the new category
    if (selectedBandAlbum && !bandAlbums.includes(selectedBandAlbum)) {
      setSelectedBandAlbum(undefined);
    }
    // Clear tags that are not available in the new category
    if (selectedTags.length > 0) {
      const validTags = selectedTags.filter(tag => allTags.includes(tag));
      if (validTags.length !== selectedTags.length) {
        setSelectedTags(validTags);
      }
    }
  }, [selectedCategoryId, bandAlbums, allTags, selectedBandAlbum, selectedTags]);
  
  // Determine which data to use: search results or fallback to all songs in category
  const hasSearchCriteria = search.trim().length > 0;
  const displaySongsData = (songsData && songsData.length > 0) ? songsData : (hasSearchCriteria && allSongsInCategory) ? allSongsInCategory : songsData;
  const isShowingFallback = hasSearchCriteria && songsData?.length === 0 && allSongsInCategory && allSongsInCategory.length > 0;
  
  // Transform songs data with file count and thumbnail
  const songs = displaySongsData?.map(song => {
    const songFiles = filesData?.filter(f => f.songId === song.id) || [];
    const firstFile = songFiles[0];
    
    // Use backend proxy endpoint for thumbnail
    const thumbnailUrl = firstFile ? `/api/files/${firstFile.id}/content` : undefined;
    const thumbnailType: "pdf" | "image" | undefined = firstFile ? (firstFile.mimeType.includes('pdf') ? 'pdf' : 'image') : undefined;
    
    return {
      id: song.id,
      title: song.title,
      category: categoryMap.get(song.categoryId) || '',
      bandAlbum: song.bandAlbum || '',
      tags: song.tags || [],
      versions: songFiles.length,
      thumbnailUrl,
      thumbnailType,
    };
  }) || [];
  
  // Transform songs with files for file selection (use displaySongsData for consistency)
  const songsWithFiles: SongWithFiles[] = displaySongsData?.map(song => ({
    id: song.id,
    title: song.title,
    category: categoryMap.get(song.categoryId) || '',
    bandAlbum: song.bandAlbum || '',
    files: (filesData?.filter(f => f.songId === song.id) || []).map(file => ({
      id: file.id,
      name: file.name,
      // Detect file type from mimeType: PDF or any image format (JPG, PNG, GIF, WebP, etc.)
      type: file.mimeType.includes('pdf') ? 'pdf' : 'image',
      size: formatFileSize(file.size),
    })),
  })) || [];

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedBandAlbum(undefined);
    setSelectedTags([]);
  };

  const handleView = (id: string) => {
    console.log("檢視詩歌:", id);
    
    // Find the song and its files
    const song = songsWithFiles.find(s => s.id === id);
    if (!song) return;
    
    // If the song has no files, show a message
    if (song.files.length === 0) {
      console.log("此詩歌沒有檔案");
      return;
    }
    
    // If the song has only one file, directly open the viewer
    if (song.files.length === 1) {
      const file = song.files[0];
      const fileData = filesData?.find(f => f.id === file.id);
      
      if (!fileData) return;
      
      const contentUrl = `/api/files/${file.id}/content`;
      
      const previewFile: FilePreview = {
        id: file.id,
        songTitle: song.title,
        fileName: file.name,
        fileUrl: contentUrl,
        fileType: file.type === "pdf" || file.type === "image" ? file.type : undefined,
        songInfo: {
          category: song.category,
          bandAlbum: song.bandAlbum,
        },
      };
      
      setPreviewFiles([previewFile]);
      setShowViewer(true);
    } else {
      // If the song has multiple files, open the file selection dialog
      setSelectedSongs(new Set([id]));
      setShowFileDialog(true);
    }
  };

  const handleDownload = async (id: string) => {
    console.log("下載詩歌:", id);
    
    // Find the song and its files
    const song = songsWithFiles.find(s => s.id === id);
    if (!song) {
      toast({
        title: "找不到詩歌",
        description: "無法找到指定的詩歌",
        variant: "destructive",
      });
      return;
    }
    
    if (song.files.length === 0) {
      toast({
        title: "沒有可下載的檔案",
        description: "此詩歌尚未有檔案，請稍後再試",
        variant: "destructive",
      });
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      // Download files by fetching as blobs first, then triggering downloads
      for (let i = 0; i < song.files.length; i++) {
        const file = song.files[i];
        
        // Stagger downloads to avoid browser blocking
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const contentUrl = `/api/files/${file.id}/content?download=true`;
        const response = await fetch(contentUrl, { credentials: 'include' });
        
        if (!response.ok) {
          // Handle 401 specifically - session may have expired
          if (response.status === 401) {
            toast({
              title: "請先登入",
              description: "下載功能需要登入才能使用",
              variant: "destructive",
            });
            return;
          }
          console.error(`Failed to download ${file.name}`);
          failCount++;
          continue;
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        successCount++;
      }
      
      // Show success toast
      if (successCount > 0) {
        toast({
          title: "下載完成",
          description: failCount > 0 
            ? `成功下載 ${successCount} 個檔案，${failCount} 個失敗` 
            : `成功下載 ${successCount} 個檔案`,
        });
      } else if (failCount > 0) {
        toast({
          title: "下載失敗",
          description: `${failCount} 個檔案下載失敗`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("下載失敗:", error);
      toast({
        title: "下載失敗",
        description: "無法下載檔案，請稍後再試",
        variant: "destructive",
      });
    }
  };

  // Edit song mutation
  const editSongMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; categoryId: string; bandAlbum: string | null; tags: string[] } }) => {
      return await apiRequest("PATCH", `/api/songs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/all-for-filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs/fallback"] });
      setShowEditDialog(false);
      setEditingSong(null);
      toast({
        title: "成功",
        description: "詩歌資料已更新",
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

  const handleEdit = (id: string) => {
    // Find the full song data from songsData
    const songData = displaySongsData?.find(s => s.id === id);
    if (songData) {
      setEditingSong({
        id: songData.id,
        title: songData.title,
        categoryId: songData.categoryId,
        bandAlbum: songData.bandAlbum,
        tags: songData.tags,
        uploadedBy: null,
      } as Song);
      setShowEditDialog(true);
    }
  };

  const handleEditSubmit = async (data: { title: string; categoryId: string; tags: string[]; bandAlbum?: string | null }) => {
    if (editingSong) {
      await editSongMutation.mutateAsync({ 
        id: editingSong.id, 
        data: {
          ...data,
          bandAlbum: data.bandAlbum ?? null
        }
      });
    }
  };

  const handleSelectSong = (id: string, selected: boolean) => {
    setSelectedSongs((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleViewSelected = () => {
    setShowFileDialog(true);
  };

  const handleClearSelection = () => {
    setSelectedSongs(new Set());
  };

  const handleFileSelectionConfirm = (selectedFiles: { songId: string; fileId: string }[]) => {
    const files: FilePreview[] = selectedFiles
      .map(({ songId, fileId }) => {
        const songWithFiles = songsWithFiles.find((s) => s.id === songId);
        const file = songWithFiles?.files.find((f) => f.id === fileId);
        const fileData = filesData?.find((f) => f.id === fileId);
        
        if (!songWithFiles || !file || !fileData) return null;

        // Use backend proxy endpoint to fetch file content
        const contentUrl = `/api/files/${fileId}/content`;

        return {
          id: fileId,
          songTitle: songWithFiles.title,
          fileName: file.name,
          fileUrl: contentUrl,
          fileType: file.type === "pdf" || file.type === "image" ? file.type : undefined,
          songInfo: {
            category: songWithFiles.category,
            bandAlbum: songWithFiles.bandAlbum,
          },
        } as FilePreview;
      })
      .filter((f): f is FilePreview => f !== null);

    setPreviewFiles(files);
    setShowViewer(true);
  };

  const selectedSongsList = songsWithFiles.filter((song) => selectedSongs.has(song.id));

  return (
    <>
      <FileSelectionDialog
        open={showFileDialog}
        onOpenChange={setShowFileDialog}
        songs={selectedSongsList}
        onConfirm={handleFileSelectionConfirm}
      />

      {showViewer && (
        <SongViewer
          files={previewFiles}
          onClose={() => setShowViewer(false)}
          isAuthenticated={isAuthenticated}
        />
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Warning banner when catalog is uninitialized */}
        {syncStatus && !syncStatus.initialized && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              詩歌庫正在從 Google Drive 進行首次同步，請稍候。系統會在同步完成後自動更新。
            </AlertDescription>
          </Alert>
        )}
        
        {syncStatus && syncStatus.initialized && !syncStatus.lastSuccess && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              詩歌庫尚未完成初始化。請聯絡管理員或稍後再試。
            </AlertDescription>
          </Alert>
        )}

        {selectedSongs.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border border-primary/20 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-base px-3 py-1.5 shadow-sm">
                {selectedSongs.size}
              </Badge>
              <span className="font-medium text-foreground">首詩歌已選擇</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleViewSelected}
                className="shadow-sm"
                data-testid="button-view-selected"
              >
                <Eye className="h-4 w-4 mr-1.5" />
                檢視選擇的詩歌
              </Button>
              <Button
                variant="outline"
                onClick={handleClearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4 mr-1.5" />
                清除選擇
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <SearchBar value={search} onChange={setSearch} />

        <div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full justify-between h-10 bg-card/50 hover:bg-card border-border/50"
            data-testid="button-toggle-filters"
          >
            <span className="text-muted-foreground">{showFilters ? "隱藏" : "顯示"}進階篩選</span>
            {showFilters ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          {showFilters && (
            <div className="mt-4">
              <FilterPanel
                selectedCategory={selectedCategory}
                selectedBandAlbum={selectedBandAlbum}
                selectedTags={selectedTags}
                categories={categories}
                bandAlbums={bandAlbums}
                availableTags={allTags}
                onCategoryChange={setSelectedCategory}
                onBandAlbumChange={setSelectedBandAlbum}
                onTagToggle={handleTagToggle}
                onClearFilters={handleClearFilters}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              搜尋結果
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              共 {songs.length} 首詩歌
              {selectedCategory && selectedCategory !== "all" && (
                <span className="ml-2">• 分類：{selectedCategory}</span>
              )}
              {(!selectedCategory || selectedCategory === "all") && (
                <span className="ml-2">• 全域搜尋</span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex gap-1 border border-border/50 rounded-lg p-1 bg-card/50 shadow-sm">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="transition-all"
                data-testid="button-view-grid"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="transition-all"
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {isShowingFallback && (
          <div className="mb-4 p-4 bg-accent/10 border border-accent/20 rounded-xl">
            <p className="text-sm text-muted-foreground">
              沒有符合搜尋條件「<span className="font-medium text-foreground">{search}</span>」的詩歌。以下顯示
              {selectedCategory && selectedCategory !== "all" ? `「${selectedCategory}」分類中` : ""}
              的所有詩歌，您可以瀏覽查找。
            </p>
          </div>
        )}
        
        {songsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
            <span>載入中...</span>
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Grid3x3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">目前沒有詩歌</p>
            <p className="text-sm">請在 Google Drive 資料夾中上傳檔案</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                id={song.id}
                title={song.title}
                category={song.category}
                bandAlbum={song.bandAlbum}
                tags={song.tags}
                versions={song.versions}
                thumbnailUrl={song.thumbnailUrl}
                thumbnailType={song.thumbnailType}
                selected={selectedSongs.has(song.id)}
                onSelect={(selected: boolean) => handleSelectSong(song.id, selected)}
                onView={() => handleView(song.id)}
                onEdit={() => handleEdit(song.id)}
                onDownload={() => handleDownload(song.id)}
                isAuthenticated={isAuthenticated}
                canEdit={canEdit}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {songs.map((song) => (
              <SongListItem
                key={song.id}
                id={song.id}
                title={song.title}
                category={song.category}
                bandAlbum={song.bandAlbum}
                tags={song.tags}
                versions={song.versions}
                thumbnailUrl={song.thumbnailUrl}
                thumbnailType={song.thumbnailType}
                selected={selectedSongs.has(song.id)}
                onSelect={(selected: boolean) => handleSelectSong(song.id, selected)}
                onView={() => handleView(song.id)}
                onEdit={() => handleEdit(song.id)}
                onDownload={() => handleDownload(song.id)}
                isAuthenticated={isAuthenticated}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Edit Song Dialog */}
      <EditSongDialog
        open={showEditDialog}
        onOpenChange={(open: boolean) => {
          setShowEditDialog(open);
          if (!open) setEditingSong(null);
        }}
        song={editingSong}
        categories={categoriesData || []}
        onSubmit={handleEditSubmit}
        isPending={editSongMutation.isPending}
      />
    </>
  );
}
