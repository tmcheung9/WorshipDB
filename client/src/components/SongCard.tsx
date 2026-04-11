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
    <Card
      className="group transition-all duration-300 hover-elevate active-elevate-2 animate-fade-in hover:border-primary/30 hover:shadow-md"
      data-testid={`card-song-${title}`}
    >
      <div className="aspect-[3/4] bg-gradient-to-br from-muted/40 to-primary/5 flex items-center justify-center relative overflow-hidden rounded-t-lg group-hover:from-primary/8 group-hover:to-primary/12 transition-colors duration-500">
        {thumbnailUrl ? (
          thumbnailType === 'pdf' ? (
            <PDFThumbnail
              fileUrl={thumbnailUrl}
              alt={title}
              className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Music className="h-7 w-7 text-muted-foreground/40" />
            </div>
          </div>
        )}
        {onSelect && (
          <div className="absolute top-3 left-3">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="bg-card/90 backdrop-blur-sm border shadow-sm"
              data-testid={`checkbox-select-${title}`}
            />
          </div>
        )}
        {versions > 1 && (
          <Badge
            variant="secondary"
            className="absolute top-3 right-3 shadow-sm text-xs"
            data-testid={`badge-versions-${versions}`}
          >
            {versions} 個版本
          </Badge>
        )}
      </div>

      <CardContent className="p-3.5 space-y-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground" data-testid="text-song-title">
          {title}
        </h3>
        <div className="space-y-1 text-xs">
          <p className="line-clamp-1 text-muted-foreground" data-testid="text-category">
            {category || '未分類'}
          </p>
          <p className="line-clamp-1 text-muted-foreground/70" data-testid="text-band-album">
            {bandAlbum || '未提供'}
          </p>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5" data-testid="text-tags">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground/50">+{tags.length - 3}</span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground/40 text-[10px] pt-0.5" data-testid="text-tags">暫無標籤</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-3.5 pt-0 flex gap-1.5 flex-wrap">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={onView}
          data-testid="button-view-song"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
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
            <Edit className="h-3.5 w-3.5 mr-1" />
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
            <Download className="h-3.5 w-3.5 mr-1" />
            下載
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
