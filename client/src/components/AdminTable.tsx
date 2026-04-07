import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Song } from "@shared/schema";

export interface SongData extends Song {
  categoryName?: string;
  fileCount?: number;
  uploaderName?: string;
}

export interface AdminTableProps {
  songs: SongData[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

export function AdminTable({
  songs,
  onView,
  onEdit,
  onDelete,
  sortColumn,
  sortDirection,
  onSort,
  currentPage = 1,
  pageSize = 50,
  totalItems = 0,
  onPageChange,
}: AdminTableProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1 text-primary" />
      : <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
  };

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead>
      <Button
        variant="ghost"
        onClick={() => onSort?.(column)}
        className={`h-8 px-2 hover:bg-muted ${sortColumn === column ? 'font-semibold text-primary' : ''}`}
      >
        {children}
        {renderSortIcon(column)}
      </Button>
    </TableHead>
  );

  // Generate page numbers with ellipsis
  const renderPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, current, and surrounding pages
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="title">詩歌名稱</SortableHeader>
              <SortableHeader column="categoryName">分類</SortableHeader>
              <SortableHeader column="bandAlbum">樂團 / 專輯</SortableHeader>
              <TableHead>標籤</TableHead>
              <SortableHeader column="fileCount">檔案數</SortableHeader>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {songs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                尚無詩歌資料
              </TableCell>
            </TableRow>
          ) : (
            songs.map((song) => (
              <TableRow key={song.id} data-testid={`row-song-${song.id}`}>
                <TableCell className="font-medium">{song.title}</TableCell>
                <TableCell>{song.categoryName || "-"}</TableCell>
                <TableCell>{song.bandAlbum || "-"}</TableCell>
                <TableCell>
                  {song.tags && song.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {song.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {song.fileCount && song.fileCount > 1 ? (
                    <Badge variant="secondary">{song.fileCount}</Badge>
                  ) : (
                    song.fileCount || "-"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView?.(song.id)}
                      data-testid={`button-view-${song.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit?.(song.id)}
                      data-testid={`button-edit-${song.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete?.(song.id)}
                      data-testid={`button-delete-${song.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

    {totalPages > 1 && (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="outline"
              size="default"
              onClick={() => currentPage > 1 && onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              className="gap-1 pl-2.5 cursor-pointer"
            >
              上一頁
            </Button>
          </PaginationItem>

          {renderPageNumbers().map((page, idx) => (
            <PaginationItem key={idx}>
              {page === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  onClick={() => onPageChange?.(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <Button
              variant="outline"
              size="default"
              onClick={() => currentPage < totalPages && onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="gap-1 pr-2.5 cursor-pointer"
            >
              下一頁
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )}
  </div>
  );
}
