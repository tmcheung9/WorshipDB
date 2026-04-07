# 教會敬拜詩歌歌譜管理系統 - 技術規格文件 v1.0

**版本**: 1.0  
**發布日期**: 2025-11-19  
**狀態**: Production Ready

## 概述

教會敬拜詩歌歌譜管理系統是一個全功能的詩歌檔案管理應用程式，整合 Google Drive 雲端儲存，提供強大的搜尋、瀏覽、檢視功能，專為敬拜團隊設計。

## 核心功能

### 1. Google Drive 整合
- **自動同步**: 從 Google Drive 根資料夾動態同步子資料夾作為分類
- **檔案支援**: PDF、JPG、PNG、GIF 等圖片格式
- **分類結構**: 5 個預設分類（傳統詩歌、其他、深恩集詩歌、讚美之泉、香港本地創作）
- **檔案分組**: 相同檔名自動分組為同一首詩歌的不同版本

### 2. 搜尋功能
- **全域搜尋**: 預設搜尋所有分類
- **分類篩選**: 可選擇特定分類進行搜尋
- **智能回退**: 無搜尋結果時自動顯示該分類所有詩歌
- **即時搜尋**: 輸入時即時顯示結果

### 3. 雙視圖模式
- **網格視圖 (Grid)**: 卡片式佈局，顯示縮圖預覽
- **列表視圖 (List)**: 緊湊列表，顯示更多元數據
- **一鍵切換**: 保留選擇狀態
- **統一體驗**: 兩種視圖都支援選擇、檢視、下載

### 4. 檔案預覽系統
- **PDF 內嵌檢視**: 使用 react-pdf 和 PDF.js 實現可靠的跨瀏覽器 PDF 渲染
- **圖片預覽**: 支援 JPG、PNG、GIF 等格式
- **縮圖一致性**: PDF 和圖片縮圖外觀完全一致
- **動態尺寸**: PDF 縮圖自動適應容器大小
- **全螢幕檢視器**: 多標籤檢視，支援縮放控制（50%-200%）

### 5. 詩歌元數據
- **必填欄位**: 詩歌名稱、分類
- **選填欄位**: 作曲、填詞、樂團、專輯、節奏
- **多檔案支援**: 每首詩歌可有多個檔案（不同編曲、格式）

## 技術架構

### 前端技術棧
- **框架**: React 18 + TypeScript
- **路由**: Wouter
- **狀態管理**: TanStack Query v5
- **UI 組件**: Shadcn UI + Tailwind CSS
- **PDF 渲染**: react-pdf + PDF.js
- **建置工具**: Vite
- **圖示**: Lucide React

### 後端技術棧
- **執行環境**: Node.js + Express
- **資料庫**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **API 整合**: Google Drive API (Replit Connector)
- **檔案代理**: Express 檔案代理端點

### 資料庫架構

#### users 表
```typescript
{
  id: varchar("id").primaryKey()
  email: text("email").notNull().unique()
  role: text("role").notNull().default("viewer")
}
```

#### categories 表
```typescript
{
  id: varchar("id").primaryKey()
  name: text("name").notNull()
  driveId: text("drive_id").unique()
}
```

#### songs 表
```typescript
{
  id: varchar("id").primaryKey()
  title: text("title").notNull()
  categoryId: varchar("category_id").references(categories.id)
  composer: text("composer")
  lyricist: text("lyricist")
  band: text("band")
  album: text("album")
  tempo: text("tempo")
}
```

#### files 表
```typescript
{
  id: varchar("id").primaryKey()
  songId: varchar("song_id").references(songs.id)
  driveId: text("drive_id").unique()
  filename: text("filename").notNull()
  mimeType: text("mime_type").notNull()
}
```

### API 端點

#### 分類管理
- `GET /api/categories` - 取得所有分類
- `POST /api/categories/sync` - 從 Google Drive 同步分類

#### 詩歌管理
- `GET /api/songs` - 取得詩歌列表（支援搜尋和篩選）
  - Query 參數: `search`, `categoryId`
- `POST /api/songs/sync` - 從 Google Drive 同步詩歌

#### 檔案管理
- `GET /api/files` - 取得所有檔案
- `GET /api/files/:id/content` - 代理取得檔案內容
  - 自動處理 Google Drive 身份驗證
  - 設定正確的 Content-Type 和 Content-Disposition headers

### 關鍵組件

#### PDFThumbnail Component
- **動態尺寸測量**: 使用 ref 測量容器寬度
- **PDF.js Worker**: 使用 unpkg CDN 載入
- **錯誤處理**: 優雅的錯誤顯示和載入狀態
- **效能優化**: 關閉文字層和註解層

#### PDFPreview Component
- **完整頁面顯示**: 支援分頁
- **縮放控制**: 50%-200% 縮放
- **鍵盤導航**: 上下鍵切換頁面

#### SongViewer Component
- **多標籤系統**: 同時預覽多首詩歌
- **檔案選擇**: 多檔案詩歌可選擇特定檔案
- **全螢幕模式**: 最大化檢視空間

### Google Drive 整合

#### 認證機制
- Replit Google Drive Connector
- 自動 OAuth 2.0 令牌管理
- Scopes: drive.file, drive.apps, drive.photos.readonly

#### 檔案同步流程
1. 列出根資料夾的子資料夾作為分類
2. 掃描每個分類資料夾中的檔案
3. 根據檔名分組為詩歌
4. 儲存到 PostgreSQL 資料庫
5. 自動處理重複檢查

#### 檔案存取
- 使用 Google Drive API v3
- 代理端點避免 CORS 問題
- 串流傳輸大型檔案

## 部署配置

### 環境變數
```
DATABASE_URL=<PostgreSQL connection string>
PGDATABASE=<database name>
PGHOST=<database host>
PGPASSWORD=<database password>
PGPORT=<database port>
PGUSER=<database user>
SESSION_SECRET=<session secret>
GOOGLE_DRIVE_ROOT_FOLDER_ID=<Google Drive folder ID>
```

### 建置指令
```bash
npm install              # 安裝依賴
npm run db:push         # 推送資料庫架構
npm run dev             # 開發模式
npm run build           # 生產建置
```

### 效能考量
- PDF 縮圖使用容器寬度動態渲染
- TanStack Query 自動快取和失效
- 檔案代理使用串流避免記憶體問題
- 最小化 PDF.js 組態（關閉文字層）

## 已知限制

### Google Drive 權限
- 當前使用 `drive.file` scope
- 只能存取應用程式創建的檔案
- 建議: 實作網頁上傳功能以確保完整存取

### 功能待開發
1. **AI 元數據提取** - 自動從 PDF/圖片提取作曲、填詞等資訊
2. **網頁檔案上傳** - 允許用戶從瀏覽器上傳到 Google Drive
3. **詩歌編輯** - 管理員編輯元數據介面
4. **Replit Auth** - 用戶登入和角色權限控制
5. **全文搜尋** - 搜尋 PDF 內容

## 測試資料

### 當前詩歌
1. 一千次頌讚 (.jpg)
2. 只見耶穌_主旋律五線譜 (.pdf)
3. 渴慕聖潔（譜） (.pdf)

### Google Drive 根資料夾
ID: `1qVMCSSVYP0gr-mZPgDS1yEYGhSHWIl97`

## 版本歷史

### v1.0 (2025-11-19)
- ✅ 完整的 Google Drive 整合
- ✅ PostgreSQL 資料庫架構
- ✅ 詩歌搜尋和篩選
- ✅ 雙視圖模式（網格/列表）
- ✅ PDF 和圖片內嵌預覽
- ✅ 多標籤全螢幕檢視器
- ✅ 智能搜尋回退機制
- ✅ PDF 縮圖動態尺寸匹配
- ✅ 繁體中文介面

## 安全考量

### 資料保護
- 環境變數管理敏感資訊
- 資料庫連線加密
- Google Drive API 令牌自動輪換

### 輸入驗證
- Zod schema 驗證所有 API 輸入
- SQL injection 防護（Drizzle ORM）
- XSS 防護（React 自動轉義）

## 維護指南

### 資料庫遷移
```bash
npm run db:push --force  # 強制同步 schema
```

### 清除快取
- 前端: 重新整理頁面
- 後端: 重啟應用程式

### 監控
- 檢查 Express 日誌
- 監控 Google Drive API 配額
- 追蹤資料庫連線數

## 授權
版權所有 © 2025

---
**文件版本**: 1.0  
**最後更新**: 2025-11-19
