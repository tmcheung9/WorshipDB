import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Eye, Music, Edit } from "lucide-react";
import { PDFThumbnail } from "@/components/PDFThumbnail";

export interface SongListItemProps {
  id: string;
  title: string;
  category?: string;
  bandAlbum?: string;
  tags?: string[];
  versions?: number;
  thumbnailUrl?: string;
  thumbnailType?: 'pdf' | 'image';
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onView?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
  isAuthenticated?: boolean;
  canEdit?: boolean;
}

export function SongListItem({
  title,
  category,
  bandAlbum,
  tags,
  versions = 1,
  thumbnailUrl,
  thumbnailType,
  selected = false,
  onSelect,
  onView,
  onEdit,
  onDownload,
  isAuthenticated = false,
  canEdit = false,
}: SongListItemProps) {
  return (
    <div 
      className="flex items-center gap-4 p-4 border border-border/50 rounded-xl hover-elevate active-elevate-2 bg-card shadow-sm transition-all duration-200 group"
      data-testid={`list-item-song-${title}`}
    >
      {onSelect && (
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          className="border-2"
          data-testid={`checkbox-select-${title}`}
        />
      )}
      
      <div className="w-16 h-16 bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center rounded-lg flex-shrink-0 overflow-hidden">
        {thumbnailUrl ? (
          thumbnailType === 'pdf' ? (
            <PDFThumbnail
              fileUrl={thumbnailUrl}
              alt={title}
              className="w-full h-full rounded-lg transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : (
          <Music className="h-7 w-7 text-muted-foreground/50" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-semibold text-base truncate text-foreground" data-testid="text-song-title">
            {title}
          </h3>
          {versions > 1 && (
            <Badge variant="secondary" className="text-xs shadow-sm" data-testid={`badge-versions-${versions}`}>
              {versions} 版本
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="truncate" data-testid="text-category">
            <span className="text-muted-foreground">分類：</span>
            <span className="text-foreground/80">{category || '未分類'}</span>
          </span>
          <span className="truncate" data-testid="text-band-album">
            <span className="text-muted-foreground">樂團：</span>
            <span className="text-foreground/80">{bandAlbum || '未提供'}</span>
          </span>
          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1.5" data-testid="text-tags">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <Button
          variant="default"
          size="sm"
          onClick={onView}
          className="shadow-sm"
          data-testid="button-view-song"
        >
          <Eye className="h-4 w-4 mr-1.5" />
          檢視
        </Button>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            data-testid="button-edit-song"
          >
            <Edit className="h-4 w-4 mr-1.5" />
            編輯
          </Button>
        )}
        {isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            data-testid="button-download-song"
          >
            <Download className="h-4 w-4 mr-1.5" />
            下載
          </Button>
        )}
      </div>
    </div>
  );
}
