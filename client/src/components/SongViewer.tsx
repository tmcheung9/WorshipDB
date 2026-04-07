import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFPreview, PDFPreviewRef } from "@/components/PDFPreview";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Hook to create and manage a dedicated overlay host element
function useOverlayHost() {
  const overlayHost = useMemo(() => {
    const div = document.createElement('div');
    div.setAttribute('data-song-viewer-root', '');
    div.className = 'bg-background';
    // Apply all positioning inline - use BLOCK not GRID to avoid making children grid items
    div.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      display: block !important;
      z-index: 2147483647 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      transform: none !important;
    `;
    return div;
  }, []);

  useEffect(() => {
    // Save original body/root styles
    const body = document.body;
    const root = document.getElementById('root');
    const originalBodyStyles = {
      paddingTop: body.style.paddingTop,
      marginTop: body.style.marginTop,
      transform: body.style.transform,
      overflow: body.style.overflow,
    };
    const originalRootStyles = root ? {
      paddingTop: root.style.paddingTop,
      marginTop: root.style.marginTop,
      transform: root.style.transform,
    } : null;

    // Override body/root styles to eliminate Replit banner offset
    body.style.setProperty('padding-top', '0', 'important');
    body.style.setProperty('margin-top', '0', 'important');
    body.style.setProperty('transform', 'none', 'important');
    body.style.setProperty('overflow', 'hidden', 'important');
    if (root) {
      root.style.setProperty('padding-top', '0', 'important');
      root.style.setProperty('margin-top', '0', 'important');
      root.style.setProperty('transform', 'none', 'important');
    }

    // Hide Replit dev banner if it exists
    const replitBanner = document.querySelector('div[style*="position: fixed"][style*="top"]');
    let originalBannerDisplay = '';
    if (replitBanner instanceof HTMLElement && replitBanner.style.position === 'fixed') {
      originalBannerDisplay = replitBanner.style.display;
      replitBanner.style.display = 'none';
    }

    // Append overlay host to body
    document.body.appendChild(overlayHost);

    // Cleanup on unmount
    return () => {
      // Restore Replit banner
      if (replitBanner instanceof HTMLElement) {
        replitBanner.style.display = originalBannerDisplay;
      }
      // Restore original styles
      body.style.paddingTop = originalBodyStyles.paddingTop;
      body.style.marginTop = originalBodyStyles.marginTop;
      body.style.transform = originalBodyStyles.transform;
      body.style.overflow = originalBodyStyles.overflow;
      if (root && originalRootStyles) {
        root.style.paddingTop = originalRootStyles.paddingTop;
        root.style.marginTop = originalRootStyles.marginTop;
        root.style.transform = originalRootStyles.transform;
      }
      // Remove overlay host
      if (overlayHost.parentNode) {
        overlayHost.parentNode.removeChild(overlayHost);
      }
    };
  }, [overlayHost]);

  return overlayHost;
}

export interface FilePreview {
  id: string;
  songTitle: string;
  fileName: string;
  fileUrl?: string;
  fileType?: "pdf" | "image";
  songInfo?: {
    category?: string;
    bandAlbum?: string;
  };
}

export interface SongViewerProps {
  files: FilePreview[];
  onClose: () => void;
  defaultFileId?: string;
  isAuthenticated?: boolean;
}

// Tab color variants for visual distinction - using theme tokens
const TAB_COLORS = [
  "bg-primary/10 border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
  "bg-secondary/10 border-secondary data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground",
  "bg-accent/10 border-accent data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
  "bg-primary/20 border-primary/80 data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground",
  "bg-secondary/20 border-secondary/80 data-[state=active]:bg-secondary/90 data-[state=active]:text-secondary-foreground",
  "bg-accent/20 border-accent/80 data-[state=active]:bg-accent/90 data-[state=active]:text-accent-foreground",
];

export function SongViewer({ files: initialFiles, onClose, defaultFileId, isAuthenticated = false }: SongViewerProps) {
  const overlayHost = useOverlayHost(); // Create dedicated overlay host
  const [files, setFiles] = useState(initialFiles);
  const [removedFileIds, setRemovedFileIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(defaultFileId || initialFiles[0]?.id);
  const [zoom, setZoom] = useState(100);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<string, string>>(new Map());
  const [viewportWidth, setViewportWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 800
  );
  const { toast } = useToast();
  
  // Refs for PDF navigation - one ref per file
  const pdfRefs = useRef<Map<string, PDFPreviewRef>>(new Map());
  
  // Ref to track blob URLs for cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set());
  
  // Track viewport width for responsive sizing (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Set initial value on client
    setViewportWidth(window.innerWidth);
    
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset removed tabs when initialFiles identity changes (new file selection)
  useEffect(() => {
    setRemovedFileIds(new Set());
  }, [initialFiles]);

  // Sync local files state with props when parent updates, but respect removed tabs
  useEffect(() => {
    const filteredFiles = initialFiles.filter(f => !removedFileIds.has(f.id));
    setFiles(filteredFiles);
  }, [initialFiles, removedFileIds]);

  // Update activeTab when a file is removed
  useEffect(() => {
    if (!files.find(f => f.id === activeTab) && files.length > 0) {
      setActiveTab(files[0].id);
    }
  }, [files, activeTab]);

  // Fetch images with credentials and convert to blob URLs
  useEffect(() => {
    let isMounted = true;
    const createdBlobUrls = new Set<string>();
    
    const fetchImages = async () => {
      const newBlobUrls = new Map<string, string>();
      
      for (const file of files) {
        if (file.fileType === 'image' && file.fileUrl) {
          try {
            const response = await fetch(file.fileUrl, {
              credentials: 'include', // Include cookies for authentication
            });
            
            if (!isMounted) break; // Abort if unmounted
            
            if (response.ok) {
              const blob = await response.blob();
              
              // Check again after async operation - component might have unmounted
              if (!isMounted) {
                // Don't create blob URL if unmounted
                break;
              }
              
              const blobUrl = URL.createObjectURL(blob);
              newBlobUrls.set(file.id, blobUrl);
              createdBlobUrls.add(blobUrl);
            }
          } catch (error) {
            if (isMounted) {
              console.error('Failed to fetch image:', file.fileName, error);
            }
          }
        }
      }
      
      if (isMounted) {
        // Clear old blob URLs before setting new ones
        blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        blobUrlsRef.current = createdBlobUrls;
        setImageBlobUrls(newBlobUrls);
      }
    };
    
    fetchImages();
    
    // Cleanup: revoke blob URLs created by this effect
    return () => {
      isMounted = false;
      createdBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRemoveTab = (fileId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (files.length === 1) {
      // If it's the last file, close the viewer
      onClose();
      return;
    }

    // Mark the file as removed (persists across parent re-renders)
    setRemovedFileIds(prev => new Set(prev).add(fileId));
    
    toast({
      title: "已移除檔案",
      description: "檔案已從預覽清單中移除",
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    const successCount = { value: 0 };
    const failedFiles: string[] = [];
    const controller = new AbortController();
    
    // Download all files currently showing in preview (active tabs only)
    // Files that have been removed from preview will NOT be downloaded
    const filesToDownload = files;
    console.log(`[Download] Starting download of ${filesToDownload.length} file(s) (active tabs only)`);
    
    try {
      // Download files sequentially with per-file error handling
      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        
        // Stagger downloads to avoid browser blocking
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        try {
          const contentUrl = `/api/files/${file.id}/content?download=true`;
          console.log(`[Download] Fetching file: ${file.fileName} from ${contentUrl}`);
          
          const response = await fetch(contentUrl, { 
            credentials: 'include',
            signal: controller.signal,
          });
          
          if (!response.ok) {
            console.error(`[Download] Failed to fetch ${file.fileName}: ${response.status} ${response.statusText}`);
            // Handle 401 specifically - session may have expired
            if (response.status === 401) {
              toast({
                title: "請先登入",
                description: "下載功能需要登入才能使用",
                variant: "destructive",
              });
              setIsDownloading(false);
              return;
            }
            failedFiles.push(file.fileName);
            continue;
          }
          
          // Get the blob from response
          const blob = await response.blob();
          console.log(`[Download] Blob created for ${file.fileName}: size=${blob.size}, type=${blob.type}`);
          
          // Check if blob has content
          if (blob.size === 0) {
            console.error(`[Download] Empty blob for ${file.fileName}`);
            failedFiles.push(file.fileName);
            continue;
          }
          
          // Create blob URL
          const url = window.URL.createObjectURL(blob);
          
          // Create and trigger download using anchor element
          const link = document.createElement('a');
          link.style.display = 'none';
          link.href = url;
          link.download = file.fileName;
          document.body.appendChild(link);
          
          // Use a small delay before clicking to ensure DOM is ready
          await new Promise(resolve => setTimeout(resolve, 50));
          link.click();
          
          // Clean up after longer delay to ensure download starts
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 1000);
          
          successCount.value++;
          console.log(`[Download] Successfully triggered download for ${file.fileName}`);
        } catch (error) {
          console.error(`[Download] Error downloading ${file.fileName}:`, error);
          if ((error as Error).name === 'AbortError') {
            break; // Stop if aborted
          }
          failedFiles.push(file.fileName);
        }
      }

      // Show appropriate toast based on results
      if (successCount.value > 0 && failedFiles.length === 0) {
        toast({
          title: "下載成功",
          description: `已下載 ${successCount.value} 個檔案`,
        });
      } else if (successCount.value > 0 && failedFiles.length > 0) {
        toast({
          title: "部分下載成功",
          description: `已下載 ${successCount.value} 個檔案，${failedFiles.length} 個檔案失敗`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "下載失敗",
          description: "無法下載檔案，請稍後再試",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("下載失敗:", error);
      toast({
        title: "下載失敗",
        description: error instanceof Error ? error.message : "無法下載檔案，請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Navigate pages within current PDF
  const navigatePage = useCallback((direction: 'next' | 'prev') => {
    const currentFile = files.find(f => f.id === activeTab);
    
    if (!currentFile || currentFile.fileType !== 'pdf') {
      return;
    }
    
    const pdfRef = pdfRefs.current.get(activeTab);
    
    if (!pdfRef) {
      return;
    }
    
    if (direction === 'next') {
      pdfRef.nextPage();
    } else {
      pdfRef.prevPage();
    }
  }, [files, activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          navigatePage('prev');
          break;
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          navigatePage('next');
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigatePage, onClose]);

  if (files.length === 0) {
    return null;
  }

  const viewerContent = (
    <div className="fixed inset-0 bg-black/80" style={{ zIndex: 9999 }}>
      {/* Floating Navigation Arrows - transparent buttons on left/right sides for PDF page navigation */}
      {files.find(f => f.id === activeTab)?.fileType === 'pdf' && (
        <>
          <Button
            variant="ghost"
            size="lg"
            className="fixed left-4 top-1/2 -translate-y-1/2 z-50 rounded-full w-16 h-16 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm"
            onClick={() => navigatePage('prev')}
            data-testid="button-nav-prev"
            aria-label="上一頁"
          >
            <ChevronLeft className="h-10 w-10" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="fixed right-4 top-1/2 -translate-y-1/2 z-50 rounded-full w-16 h-16 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm"
            onClick={() => navigatePage('next')}
            data-testid="button-nav-next"
            aria-label="下一頁"
          >
            <ChevronRight className="h-10 w-10" />
          </Button>
        </>
      )}

      {/* Main content container with grid layout for toolbar/tabs/content/footer */}
      <div className="grid w-full" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, gridTemplateRows: 'auto auto 1fr auto' }}>
        {/* Grid Row 1: Header with controls - auto height */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card/95 backdrop-blur-sm" data-testid="song-viewer">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-foreground">檔案預覽</h2>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {files.length} 個檔案
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="h-8 w-8"
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-14 text-center font-medium text-muted-foreground">{zoom}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-8 w-8"
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                disabled={isDownloading}
                className="h-8 w-8"
                data-testid="button-download-all"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              data-testid="button-close-viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

      {/* Grid Row 2: Tabs row - auto height, horizontal scrolling on mobile */}
      <div className="border-b border-border/30 bg-card/95 backdrop-blur-sm px-2 md:px-4 py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          <div className="flex gap-1 md:gap-2 min-w-max pb-1">
            {files.map((file, index) => {
              const isActive = activeTab === file.id;
              const colorIndex = index % TAB_COLORS.length;
              let tabClass = '';
              
              if (isActive) {
                // Extract active state classes
                if (colorIndex === 0) tabClass = 'bg-primary text-primary-foreground border-primary';
                else if (colorIndex === 1) tabClass = 'bg-secondary text-secondary-foreground border-secondary';
                else if (colorIndex === 2) tabClass = 'bg-accent text-accent-foreground border-accent';
                else if (colorIndex === 3) tabClass = 'bg-primary/90 text-primary-foreground border-primary/80';
                else if (colorIndex === 4) tabClass = 'bg-secondary/90 text-secondary-foreground border-secondary/80';
                else tabClass = 'bg-accent/90 text-accent-foreground border-accent/80';
              } else {
                // Extract inactive state classes
                if (colorIndex === 0) tabClass = 'bg-primary/10 border-primary';
                else if (colorIndex === 1) tabClass = 'bg-secondary/10 border-secondary';
                else if (colorIndex === 2) tabClass = 'bg-accent/10 border-accent';
                else if (colorIndex === 3) tabClass = 'bg-primary/20 border-primary/80';
                else if (colorIndex === 4) tabClass = 'bg-secondary/20 border-secondary/80';
                else tabClass = 'bg-accent/20 border-accent/80';
              }
              
              return (
                <div
                  key={file.id}
                  onClick={() => setActiveTab(file.id)}
                  className={`
                    flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-lg border-2 cursor-pointer
                    transition-all hover-elevate relative group
                    min-w-[140px] md:min-w-[180px] max-w-[180px] md:max-w-[250px] flex-shrink-0
                    ${tabClass}
                  `}
                  data-testid={`tab-file-${file.id}`}
                  role="button"
                  aria-label={`切換到 ${file.songTitle}`}
                >
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="truncate font-medium text-xs md:text-sm w-full">
                      {file.songTitle}
                    </span>
                    <span className="text-[10px] md:text-xs opacity-70 truncate w-full">
                      {file.fileName}
                    </span>
                  </div>
                  <div
                    onClick={(e) => handleRemoveTab(file.id, e)}
                    className="rounded-full p-0.5 md:p-1 opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity cursor-pointer flex-shrink-0"
                    data-testid={`button-remove-tab-${file.id}`}
                    role="button"
                    aria-label="移除此檔案"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleRemoveTab(file.id, e);
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Grid Row 3: Content area - fills remaining space (1fr) */}
      <div className="overflow-auto bg-muted/30 relative min-h-0">
        {files.map((file) => (
          <div
            key={file.id}
            className={`min-h-full ${activeTab === file.id ? 'block' : 'hidden'}`}
            data-testid={`content-file-${file.id}`}
          >
            <div className="flex justify-center w-full p-2 md:p-4">
              {file.fileUrl ? (
                <div
                  className="bg-white shadow-lg rounded-lg mx-auto"
                  style={{ 
                    width: file.fileType === "pdf" ? `${Math.min(800 * zoom / 100, viewportWidth - 32)}px` : 'auto',
                    maxWidth: '100%'
                  }}
                >
                  {file.fileType === "pdf" ? (
                    <PDFPreview
                      ref={(ref) => {
                        if (ref) {
                          pdfRefs.current.set(file.id, ref);
                        } else {
                          pdfRefs.current.delete(file.id);
                        }
                      }}
                      fileUrl={file.fileUrl}
                      width={Math.min(800 * zoom / 100, viewportWidth - 32)}
                      height={1000 * zoom / 100}
                      data-testid={`preview-pdf-${file.id}`}
                    />
                  ) : (
                    <img
                      src={imageBlobUrls.get(file.id) || file.fileUrl}
                      alt={file.fileName}
                      className="block object-contain"
                      style={{
                        width: `${zoom}%`,
                        maxWidth: `${viewportWidth - 16}px`,
                        height: 'auto'
                      }}
                      data-testid={`preview-image-${file.id}`}
                      onError={(e) => {
                        console.error('圖片載入失敗:', file.fileName);
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E無法載入圖片%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Maximize2 className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{file.songTitle}</h3>
                    <p className="text-lg text-muted-foreground mb-4">{file.fileName}</p>
                    {file.songInfo?.bandAlbum && (
                      <p className="text-muted-foreground">樂團/專輯：{file.songInfo.bandAlbum}</p>
                    )}
                    {file.songInfo?.category && (
                      <p className="text-muted-foreground">分類：{file.songInfo.category}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-4">
                      檔案預覽功能即將推出
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Grid Row 4: Copyright notice footer - auto height */}
      <CopyrightNotice compact className="bg-card/95 backdrop-blur-sm" />
    </div>
    </div>
  );

  // Use React Portal to render into dedicated overlay host (not document.body)
  return createPortal(viewerContent, overlayHost);
}
