import { FileText, Shield } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 bg-muted/30 backdrop-blur-sm" data-testid="site-footer">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-disclaimer-title">Disclaimer / 免責聲明</span>
          </div>
          
          <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed" data-testid="text-disclaimer-content">
            <p>
              All song lyrics and musical arrangements provided in this application are for personal study and reference only.
              <br className="hidden sm:block" />
              <span className="block sm:inline sm:ml-1">本應用程式內之詩歌歌詞、和弦及樂譜僅供個人參考及練習用途。</span>
            </p>
            
            <p>
              All copyrights belong to their respective original publishers or owners. This content is provided for viewing only; any form of copying, downloading, or unauthorized digital distribution is strictly prohibited.
              <br className="hidden sm:block" />
              <span className="block sm:inline sm:ml-1">版權均屬原創作者或相關出版社所有。相關內容僅供閱覽，嚴禁任何形式之複製、下載或未經授權之數位發放。</span>
            </p>
            
            <p>
              Users and organizations must ensure they hold the appropriate legal licenses and permissions for any public performance, reproduction, or broadcasting of this material.
              <br className="hidden sm:block" />
              <span className="block sm:inline sm:ml-1">使用者或機構於公開場合播放、翻印或廣播相關內容前，有責任確保已獲得合法授權及相關版權許可。</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground/70">
            <FileText className="h-3 w-3" />
            <span data-testid="text-copyright-year">© {new Date().getFullYear()} 詩歌歌曲庫</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
