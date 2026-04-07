import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Eye, Music, Edit } from "lucide-react";
import { PDFThumbnail } from "@/components/PDFThumbnail";

export interface SongCardProps {
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

export function SongCard({
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
}: SongCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all duration-200 group" data-testid={`card-song-${title}`}>
      <div className="aspect-[3/4] bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center relative overflow-hidden">
        {thumbnailUrl ? (
          thumbnailType === 'pdf' ? (
            <PDFThumbnail
              fileUrl={thumbnailUrl}
              alt={title}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Music className="h-14 w-14 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground/50">無預覽圖</span>
          </div>
        )}
        {onSelect && (
          <div className="absolute top-3 left-3">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="bg-background/90 backdrop-blur-sm border-2 shadow-sm"
              data-testid={`checkbox-select-${title}`}
            />
          </div>
        )}
        {versions > 1 && (
          <Badge
            variant="secondary"
            className="absolute top-3 right-3 shadow-sm backdrop-blur-sm bg-secondary/90"
            data-testid={`badge-versions-${versions}`}
          >
            {versions} 個版本
          </Badge>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />
      </div>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-base leading-tight line-clamp-2 text-foreground" data-testid="text-song-title">
          {title}
        </h3>
        <div className="space-y-1.5 text-sm">
          <p className="line-clamp-1 flex items-center gap-1.5" data-testid="text-category">
            <span className="text-muted-foreground">分類：</span>
            <span className="font-medium text-foreground/80">{category || '未分類'}</span>
          </p>
          <p className="line-clamp-1 flex items-center gap-1.5" data-testid="text-band-album">
            <span className="text-muted-foreground">樂團：</span>
            <span className="font-medium text-foreground/80">{bandAlbum || '未提供'}</span>
          </p>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1" data-testid="text-tags">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground/60 text-xs pt-1" data-testid="text-tags">暫無標籤</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2 flex-wrap">
        <Button
          variant="default"
          size="sm"
          className="flex-1 shadow-sm"
          onClick={onView}
          data-testid="button-view-song"
        >
          <Eye className="h-4 w-4 mr-1.5" />
          檢視
        </Button>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
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
            className="flex-1"
            onClick={onDownload}
            data-testid="button-download-song"
          >
            <Download className="h-4 w-4 mr-1.5" />
            下載
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
