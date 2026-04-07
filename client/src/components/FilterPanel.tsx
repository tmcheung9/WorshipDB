import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

export interface FilterPanelProps {
  selectedCategory?: string;
  selectedBandAlbum?: string;
  selectedTags: string[];
  categories: string[];
  bandAlbums: string[];
  availableTags: string[];
  onCategoryChange: (value: string) => void;
  onBandAlbumChange: (value: string) => void;
  onTagToggle: (tag: string) => void;
  onClearFilters: () => void;
}

export function FilterPanel({
  selectedCategory,
  selectedBandAlbum,
  selectedTags,
  categories,
  bandAlbums,
  availableTags,
  onCategoryChange,
  onBandAlbumChange,
  onTagToggle,
  onClearFilters,
}: FilterPanelProps) {
  const isMobile = useIsMobile();
  const [tagsExpanded, setTagsExpanded] = useState(false);
  
  const VISIBLE_TAGS_LIMIT = 12;
  const hasMoreTags = availableTags.length > VISIBLE_TAGS_LIMIT;
  const visibleTags = tagsExpanded ? availableTags : availableTags.slice(0, VISIBLE_TAGS_LIMIT);
  const hiddenTagsCount = availableTags.length - VISIBLE_TAGS_LIMIT;
  
  const hasActiveFilters = 
    (selectedCategory && selectedCategory !== "all") || 
    selectedBandAlbum || 
    selectedTags.length > 0;

  return (
    <div className="space-y-5 p-4 bg-card/50 rounded-xl border border-border/50 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">進階篩選</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-destructive"
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4 mr-1.5" />
            清除篩選
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {/* Top row: Category and Band/Album selectors side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2.5 block text-muted-foreground">分類</label>
            {isMobile ? (
              <select
                value={selectedCategory || "all"}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                data-testid="select-category"
              >
                <option value="all">全部分類</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            ) : (
              <Select value={selectedCategory || "all"} onValueChange={onCategoryChange}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="全部分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分類</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2.5 block text-muted-foreground">樂團 / 專輯</label>
            {isMobile ? (
              <select
                value={selectedBandAlbum || "all"}
                onChange={(e) => onBandAlbumChange(e.target.value)}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                data-testid="select-band-album"
              >
                <option value="all">全部</option>
                {bandAlbums.map((bandAlbum) => (
                  <option key={bandAlbum} value={bandAlbum}>
                    {bandAlbum}
                  </option>
                ))}
              </select>
            ) : (
              <Select value={selectedBandAlbum || "all"} onValueChange={onBandAlbumChange}>
                <SelectTrigger data-testid="select-band-album">
                  <SelectValue placeholder="全部樂團/專輯" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {bandAlbums.map((bandAlbum) => (
                    <SelectItem key={bandAlbum} value={bandAlbum}>
                      {bandAlbum}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Bottom row: Tags section with full width */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-muted-foreground">標籤</label>
            {hasMoreTags && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTagsExpanded(!tagsExpanded)}
                className="h-7 px-2.5 text-xs text-primary"
                data-testid="button-toggle-tags"
              >
                {tagsExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    收合
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    展開更多 (+{hiddenTagsCount})
                  </>
                )}
              </Button>
            )}
          </div>
          {availableTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className={`cursor-pointer hover-elevate active-elevate-2 text-xs px-2.5 py-1 transition-all ${
                    selectedTags.includes(tag) ? 'shadow-sm' : ''
                  }`}
                  onClick={() => onTagToggle(tag)}
                  data-testid={`badge-tag-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground/60 italic">暫無標籤</div>
          )}
        </div>
      </div>
    </div>
  );
}
