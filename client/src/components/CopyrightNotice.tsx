import { FileText } from "lucide-react";

interface CopyrightNoticeProps {
  compact?: boolean;
  className?: string;
}

export function CopyrightNotice({ compact = false, className = "" }: CopyrightNoticeProps) {
  if (compact) {
    return (
      <div 
        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground/80 py-2 px-3 ${className}`}
        data-testid="copyright-notice-compact"
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <FileText className="h-3 w-3 flex-shrink-0" />
          <span>© 版權告示 / Copyright Notice</span>
        </div>
        <span className="text-center max-w-md">
          已獲授權使用，內容僅供參考閱覽。嚴禁擅自複製或下載。
        </span>
      </div>
    );
  }

  return (
    <div className={`border-t border-border/30 bg-card/50 backdrop-blur-sm ${className}`} data-testid="copyright-notice">
      <div className="flex items-start gap-2 px-4 py-3 text-xs text-muted-foreground/80">
        <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-foreground/70" data-testid="text-copyright-title">© Copyright Notice / 版權告示</p>
          <p data-testid="text-copyright-content">
            Reproduced for reference only under authorized licenses. No copying or downloading allowed.
            <span className="block sm:inline sm:ml-1">已獲授權使用，內容僅供參考閱覽。嚴禁擅自複製或下載。</span>
          </p>
        </div>
      </div>
    </div>
  );
}
