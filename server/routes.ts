import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSongSchema, insertFileSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, isAdmin, canUpload } from "./auth";
import bcrypt from "bcryptjs";
import multer from "multer";
import archiver from "archiver";

// Simple LRU cache with size limit for file content
// Only cache files under 10MB to prevent memory exhaustion
interface CachedFile {
  buffer: Buffer;
  createdAt: number; // For TTL expiry (1 hour from creation)
  lastAccessAt: number; // For LRU eviction (least recently accessed)
  size: number;
  modifiedTime: string; // Store modifiedTime for consistent ETag generation
}
import { generateTagsForSongs } from "./services/ai-extraction";

class FileCache {
  private cache = new Map<string, CachedFile>();
  private maxAge = 3600000; // 1 hour TTL
  private maxTotalSize = 100 * 1024 * 1024; // 100MB total cache size
  private maxFileSize = 10 * 1024 * 1024; // 10MB per file (cache only small files)
  private currentSize = 0;

  private evictOldest() {
    let oldestKey: string | null = null;
    let oldestAccessTime = Infinity;
    
    // Find entry with oldest lastAccessAt (least recently used)
    for (const [key, value] of Array.from(this.cache.entries())) {
      if (value.lastAccessAt < oldestAccessTime) {
        oldestAccessTime = value.lastAccessAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const removed = this.cache.get(oldestKey);
      if (removed) {
        this.currentSize -= removed.size;
        this.cache.delete(oldestKey);
      }
    }
  }

  get(key: string): CachedFile | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    
    // Check TTL based on creation time (expires 1 hour after creation)
    if (now - entry.createdAt > this.maxAge) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
      return null;
    }
    
    // Update last access time for LRU eviction
    entry.lastAccessAt = now;
    
    return entry;
  }

  set(key: string, buffer: Buffer, modifiedTime: string) {
    // Don't cache files larger than maxFileSize
    if (buffer.length > this.maxFileSize) {
      return;
    }
    
    // Remove old entry if exists
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }
    
    // Evict until we have space
    while (this.currentSize + buffer.length > this.maxTotalSize && this.cache.size > 0) {
      this.evictOldest();
    }
    
    // Add new entry with both timestamps
    const now = Date.now();
    this.cache.set(key, { 
      buffer, 
      createdAt: now,      // For TTL expiry
      lastAccessAt: now,   // For LRU eviction
      size: buffer.length,
      modifiedTime 
    });
    this.currentSize += buffer.length;
  }

  getStats() {
    return {
      entries: this.cache.size,
      totalSize: this.currentSize,
      maxTotalSize: this.maxTotalSize,
    };
  }
}

const fileCache = new FileCache();

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Health check endpoint for Google Cloud load balancer
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      // req.user is already populated by passport (without password)
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User registration (admin only can create users)
  app.post("/api/users", isAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });
      
      // Don't return password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      // Check for unique constraint violations
      if (error.code === '23505') {
        if (error.constraint === 'users_email_unique') {
          return res.status(409).json({ error: "此電子郵件已被使用" });
        }
        if (error.constraint === 'users_username_unique') {
          return res.status(409).json({ error: "此用戶名已被使用" });
        }
      }
      
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Categories routes
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Admin category CRUD routes (for manual categories)
  // Create a new manual category
  app.post("/api/admin/categories", isAdmin, async (req, res) => {
    try {
      const { name, driveId } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "分類名稱為必填" });
      }
      
      const category = await storage.createCategory(name.trim(), driveId || null);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        if (error.constraint?.includes('name')) {
          return res.status(409).json({ error: "此分類名稱已存在" });
        }
        if (error.constraint?.includes('drive_id')) {
          return res.status(409).json({ error: "此 Google Drive ID 已被使用" });
        }
      }
      
      res.status(500).json({ error: "建立分類失敗" });
    }
  });

  // Update a category
  app.patch("/api/admin/categories/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, driveId } = req.body;
      
      const existingCategory = await storage.getCategoryById(id);
      if (!existingCategory) {
        return res.status(404).json({ error: "分類不存在" });
      }
      
      // Build update data
      const updateData: { name?: string; driveId?: string | null } = {};
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
          return res.status(400).json({ error: "分類名稱不可為空" });
        }
        updateData.name = name.trim();
      }
      if (driveId !== undefined) {
        updateData.driveId = driveId || null;
      }
      
      const category = await storage.updateCategory(id, updateData);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating category:", error);
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        if (error.constraint?.includes('name')) {
          return res.status(409).json({ error: "此分類名稱已存在" });
        }
        if (error.constraint?.includes('drive_id')) {
          return res.status(409).json({ error: "此 Google Drive ID 已被使用" });
        }
      }
      
      res.status(500).json({ error: "更新分類失敗" });
    }
  });

  // Delete a category (manual only - synced categories should be deleted from Drive)
  app.delete("/api/admin/categories/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.deleteCategory(id);
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "刪除分類失敗" });
    }
  });

  // Cleanup an orphaned category (deletes all songs/files and the category)
  app.post("/api/admin/categories/:id/cleanup", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.cleanupOrphanedCategory(id);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message,
          deletedSongs: result.deletedSongs,
          deletedFiles: result.deletedFiles
        });
      } else {
        res.status(400).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error("Error cleaning up orphaned category:", error);
      res.status(500).json({ error: "清除孤立分類失敗" });
    }
  });

  // Sync endpoints - admin only (triggers Google Drive sync with tracking)
  // Note: These are legacy endpoints - prefer using /api/sync/trigger
  app.post("/api/categories/sync", isAdmin, async (_req, res) => {
    try {
      console.log("[Legacy Sync] /api/categories/sync called - using performSyncWithTracking");
      const result = await storage.performSyncWithTracking(true); // isManual = true
      
      if (result.success) {
        const categories = await storage.getAllCategories();
        res.json(categories);
      } else {
        res.status(500).json({ error: result.message });
      }
    } catch (error) {
      console.error("Error syncing categories:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Failed to sync: ${errorMessage}` });
    }
  });

  app.post("/api/songs/sync", isAdmin, async (_req, res) => {
    try {
      console.log("[Legacy Sync] /api/songs/sync called - using performSyncWithTracking");
      const result = await storage.performSyncWithTracking(true); // isManual = true
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error("Error syncing songs:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: `Failed to sync: ${errorMessage}` });
    }
  });

  // Deleted drive IDs management (admin only) - for recovery scenarios
  app.get("/api/deleted-drive-ids", isAdmin, async (_req, res) => {
    try {
      const deletedIds = await storage.getDeletedDriveIds();
      res.json({ deletedIds: Array.from(deletedIds), count: deletedIds.size });
    } catch (error) {
      console.error("Error fetching deleted drive IDs:", error);
      res.status(500).json({ error: "Failed to fetch deleted drive IDs" });
    }
  });

  app.delete("/api/deleted-drive-ids/:driveId", isAdmin, async (req, res) => {
    try {
      const deleted = await storage.clearDeletedDriveId(req.params.driveId);
      if (deleted) {
        res.json({ success: true, message: "已清除刪除記錄，下次同步時檔案將可重新匯入" });
      } else {
        res.status(404).json({ error: "未找到此Drive ID記錄" });
      }
    } catch (error) {
      console.error("Error clearing deleted drive ID:", error);
      res.status(500).json({ error: "Failed to clear deleted drive ID" });
    }
  });

  app.delete("/api/deleted-drive-ids", isAdmin, async (_req, res) => {
    try {
      const count = await storage.clearAllDeletedDriveIds();
      res.json({ success: true, message: `已清除 ${count} 筆刪除記錄，下次同步時所有檔案將可重新匯入` });
    } catch (error) {
      console.error("Error clearing all deleted drive IDs:", error);
      res.status(500).json({ error: "Failed to clear all deleted drive IDs" });
    }
  });

  // Songs routes
  app.get("/api/songs", async (req, res) => {
    try {
      const { search, categoryId, bandAlbum, tags } = req.query;
      
      let songs;
      if (search) {
        songs = await storage.searchSongs(
          search as string,
          categoryId ? (categoryId as string) : undefined
        );
      } else if (categoryId) {
        songs = await storage.getSongsByCategoryId(categoryId as string);
      } else {
        songs = await storage.getAllSongs();
      }
      
      // Client-side filtering for metadata fields
      if (bandAlbum) {
        songs = songs.filter(song => song.bandAlbum === bandAlbum);
      }
      
      // Filter by tags (if tags are provided, filter songs that have ANY of the selected tags)
      if (tags) {
        const selectedTags = Array.isArray(tags) ? tags : [tags];
        songs = songs.filter(song => {
          if (!song.tags || song.tags.length === 0) return false;
          // Check if song has any of the selected tags (OR logic, not AND)
          return selectedTags.some(tag => {
            const cleanTag = (tag as string).trim();
            return song.tags?.some((songTag: string) => songTag?.trim() === cleanTag);
          });
        });
      }
      
      res.json(songs);
    } catch (error) {
      console.error("Error fetching songs:", error);
      res.status(500).json({ error: "Failed to fetch songs" });
    }
  });

  app.get("/api/songs/:id", async (req, res) => {
    try {
      const song = await storage.getSongById(req.params.id);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      console.error("Error fetching song:", error);
      res.status(500).json({ error: "Failed to fetch song" });
    }
  });

  app.post("/api/songs", canUpload, async (req: any, res) => {
    try {
      const userId = req.user.id; // passport-local stores user directly in req.user
      const validatedData = insertSongSchema.parse({
        ...req.body,
        uploadedBy: userId,
      });
      const song = await storage.createSong(validatedData);
      res.status(201).json(song);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating song:", error);
      res.status(500).json({ error: "Failed to create song" });
    }
  });

  app.patch("/api/songs/:id", canUpload, async (req, res) => {
    try {
      // Validate update data with partial schema - exclude uploadedBy to prevent privilege escalation
      const updateData = insertSongSchema.omit({ uploadedBy: true }).partial().parse(req.body);
      const song = await storage.updateSong(req.params.id, updateData);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating song:", error);
      res.status(500).json({ error: "Failed to update song" });
    }
  });

  app.delete("/api/songs/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteSong(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting song:", error);
      res.status(500).json({ error: "Failed to delete song" });
    }
  });

  // Delete file from Google Drive by driveId (admin only) - for cleanup
  app.delete("/api/drive/files/:driveId", isAdmin, async (req, res) => {
    try {
      const { deleteFile } = await import("./google-drive");
      await deleteFile(req.params.driveId);
      console.log(`[Admin] Deleted file from Drive: ${req.params.driveId}`);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting file from Drive:", error);
      res.status(500).json({ error: "Failed to delete file from Drive", message: error.message });
    }
  });

  // Files routes
  app.get("/api/files", async (req, res) => {
    try {
      const { songId } = req.query;
      
      let files;
      if (songId) {
        files = await storage.getFilesBySongId(songId as string);
      } else {
        files = await storage.getAllFiles();
      }
      
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFileById(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Error fetching file:", error);
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  // Proxy endpoint to fetch file content from Google Drive (with smart caching)
  // Public access: anyone can VIEW file content (inline)
  // Authenticated access: only logged-in users can DOWNLOAD (attachment)
  // Query param: ?download=true to force download (requires authentication)
  app.get("/api/files/:id/content", async (req, res) => {
    try {
      // Try lookup by database file ID first
      let file = await storage.getFileById(req.params.id);
      
      // Fallback: if not found by database ID, try by driveId
      // This handles cases where driveId is accidentally used instead of database ID
      if (!file) {
        file = await storage.getFileByDriveId(req.params.id);
      }
      
      if (!file || !file.driveId) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check if download mode is requested
      const isDownload = req.query.download === 'true';
      
      // Download requires authentication - only logged-in users can download
      if (isDownload && !req.isAuthenticated?.()) {
        return res.status(401).json({ error: "請先登入才能下載檔案" });
      }
      
      const disposition = isDownload ? 'attachment' : 'inline';

      // Check cache first
      const cached = fileCache.get(file.driveId);
      
      if (cached) {
        // Serve from cache (fast path for small files)
        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        // Use consistent ETag format with modifiedTime from cache
        res.setHeader('ETag', `"${file.driveId}-${cached.modifiedTime}"`);
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        
        const encodedFilename = encodeURIComponent(file.name);
        res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Length', cached.buffer.length);
        
        return res.send(cached.buffer);
      }

      // Not in cache - fetch from Google Drive
      const { getUncachableGoogleDriveClient } = await import("./google-drive");
      const drive = await getUncachableGoogleDriveClient();

      // First, get file metadata to check size
      const metadata = await drive.files.get({
        fileId: file.driveId,
        fields: 'size,modifiedTime',
        supportsAllDrives: true,
      });

      const fileSize = parseInt(metadata.data.size || '0', 10);
      const maxCacheSize = 10 * 1024 * 1024; // 10MB

      // Set common headers
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      
      // Improved ETag with modification time for cache invalidation
      const modifiedTime = metadata.data.modifiedTime || '';
      res.setHeader('ETag', `"${file.driveId}-${modifiedTime}"`);
      
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
      
      const encodedFilename = encodeURIComponent(file.name);
      res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedFilename}`);

      if (fileSize > 0) {
        res.setHeader('Content-Length', fileSize.toString());
      }

      if (fileSize <= maxCacheSize) {
        // Small file: download to buffer, cache it, then send
        const response = await drive.files.get(
          {
            fileId: file.driveId,
            alt: 'media',
            supportsAllDrives: true,
          },
          { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(response.data as ArrayBuffer);
        fileCache.set(file.driveId, buffer, modifiedTime);
        res.send(buffer);
      } else {
        // Large file: stream directly without caching (progressive delivery)
        const response = await drive.files.get(
          {
            fileId: file.driveId,
            alt: 'media',
            supportsAllDrives: true,
          },
          { responseType: 'stream' }
        );

        response.data.pipe(res);
      }
    } catch (error) {
      console.error("Error fetching file content:", error);
      res.status(500).json({ error: "Failed to fetch file content" });
    }
  });

  // Configure multer for file uploads (store in memory)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept PDF and image files only
      if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF and image files are allowed'));
      }
    },
  });

  // Upload metadata validation schema
  const uploadMetadataSchema = z.object({
    title: z.string().min(1, "Title is required").max(200),
    category: z.string().min(1, "Category is required"),
    bandAlbum: z.string().max(100).optional().nullable(),
    tags: z.string().max(500).optional().nullable(),
  });

  // Upload endpoint - handles file upload to Google Drive and creates DB records
  app.post("/api/upload", canUpload, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = req.user.id;
      
      // Validate metadata using Zod schema
      const validationResult = uploadMetadataSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid metadata",
          details: validationResult.error.errors 
        });
      }

      const { title, category, bandAlbum, tags } = validationResult.data;

      // Fix filename encoding issue: multer receives UTF-8 bytes but Node interprets as Latin-1
      // This converts it back to the correct UTF-8 string
      const originalFilename = req.file.originalname;
      const decodedFilename = Buffer.from(originalFilename, 'latin1').toString('utf8');
      
      console.log(`[Upload] User ${userId} uploading file: ${decodedFilename}`);
      console.log(`[Upload] Song: ${title}, Category: ${category}`);

      // Find the category in database
      const categories = await storage.getAllCategories();
      const categoryRecord = categories.find(c => c.name === category);
      
      if (!categoryRecord) {
        return res.status(400).json({ error: `Category "${category}" not found` });
      }

      // Upload file to Google Drive
      const { uploadFile, deleteFile } = await import("./google-drive");
      
      // Manual categories without driveId cannot receive uploads
      if (!categoryRecord.driveId) {
        return res.status(400).json({ error: "此分類沒有關聯的 Google Drive 資料夾，無法上傳檔案" });
      }
      
      console.log(`[Upload] Uploading to Google Drive folder: ${categoryRecord.driveId}`);
      
      const driveFile = await uploadFile(
        categoryRecord.driveId,
        decodedFilename,
        req.file.mimetype,
        req.file.buffer
      );

      console.log(`[Upload] File uploaded to Drive with ID: ${driveFile.id}`);

      try {
        // Check if song already exists
        const existingSongs = await storage.getSongsByCategoryId(categoryRecord.id);
        let song = existingSongs.find(s => s.title === title);

        if (!song) {
          // Create new song
          console.log(`[Upload] Creating new song: ${title}`);
          song = await storage.createSong({
            title,
            categoryId: categoryRecord.id,
            bandAlbum: bandAlbum || null,
            tags: tags ? tags.replace(/，/g, ',').split(',').map((t: string) => t.trim()).filter(Boolean) : null,
            uploadedBy: userId,
          });
        } else {
          console.log(`[Upload] Song already exists: ${title}`);
        }

        // Create file record
        const fileRecord = await storage.createFile({
          songId: song.id,
          driveId: driveFile.id,
          name: driveFile.name,
          mimeType: driveFile.mimeType,
          size: driveFile.size ? parseInt(driveFile.size) : null,
          uploadedBy: userId,
        });

        console.log(`[Upload] File record created with ID: ${fileRecord.id}`);

        res.status(201).json({
          success: true,
          song,
          file: fileRecord,
          message: `詩歌「${title}」已成功上傳`,
        });
      } catch (dbError: any) {
        // Rollback: Delete the uploaded file from Google Drive if DB operations fail
        console.error(`[Upload] Database error, rolling back Drive upload: ${driveFile.id}`);
        try {
          await deleteFile(driveFile.id);
          console.log(`[Upload] Successfully deleted orphaned file from Drive`);
        } catch (deleteError) {
          console.error(`[Upload] Failed to delete orphaned file from Drive:`, deleteError);
        }
        throw dbError; // Re-throw to trigger outer catch block
      }
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ 
        error: "Failed to upload file",
        message: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id; // passport-local stores user directly in req.user
      const validatedData = insertFileSchema.parse({
        ...req.body,
        uploadedBy: userId,
      });
      const file = await storage.createFile(validatedData);
      res.status(201).json(file);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating file:", error);
      res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.delete("/api/files/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteFile(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Download files (single or multiple as ZIP)
  app.post("/api/files/download", isAuthenticated, async (req, res) => {
    try {
      const { fileIds } = req.body as { fileIds: string[] };
      
      if (!fileIds || fileIds.length === 0) {
        return res.status(400).json({ error: "No files specified" });
      }

      // Fetch file metadata
      const fileResults = await Promise.all(
        fileIds.map(async (id) => {
          try {
            return await storage.getFileById(id);
          } catch (error) {
            console.error(`Error fetching file metadata for ${id}:`, error);
            return null;
          }
        })
      );

      const validFiles = fileResults.filter((f): f is NonNullable<typeof f> => f !== null);
      if (validFiles.length === 0) {
        return res.status(404).json({ error: "No valid files found" });
      }

      // Get Google Drive client
      const { getUncachableGoogleDriveClient } = await import("./google-drive");
      const drive = await getUncachableGoogleDriveClient();

      // Single file download
      if (validFiles.length === 1) {
        try {
          const file = validFiles[0];
          const response = await drive.files.get(
            {
              fileId: file.driveId,
              alt: 'media',
              supportsAllDrives: true,
            },
            { responseType: 'arraybuffer' }
          );
          
          const buffer = Buffer.from(response.data as ArrayBuffer);
          
          res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
          res.send(buffer);
          return;
        } catch (error) {
          console.error("Error downloading single file:", error);
          return res.status(500).json({ error: "Failed to download file from Google Drive" });
        }
      }

      // Multiple files - create ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });

      // Handle archive errors
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create archive" });
        }
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="songs.zip"');

      archive.pipe(res);

      // Download and add each file to the archive
      let successCount = 0;
      let failCount = 0;
      
      for (const file of validFiles) {
        try {
          const response = await drive.files.get(
            {
              fileId: file.driveId,
              alt: 'media',
              supportsAllDrives: true,
            },
            { responseType: 'arraybuffer' }
          );
          
          const buffer = Buffer.from(response.data as ArrayBuffer);
          archive.append(buffer, { name: file.name });
          successCount++;
        } catch (error) {
          console.error(`Failed to download file ${file.name}:`, error);
          failCount++;
          // Add error placeholder file
          archive.append(
            `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { name: `ERROR_${file.name}.txt` }
          );
        }
      }

      // Finalize the archive
      await archive.finalize();
      console.log(`Archive complete: ${successCount} files succeeded, ${failCount} files failed`);
    } catch (error) {
      console.error("Error downloading files:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download files" });
      }
    }
  });

  // Users routes (admin only for listing and role management)
  app.get("/api/users", isAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Strip passwords from all user objects
      const sanitizedUsers = users.map(({ password: _, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id; // passport-local stores user directly in req.user
      const targetUserId = req.params.id;
      
      // Users can only update their own profile unless they're admin
      if (userId !== targetUserId) {
        const currentUser = await storage.getUser(userId);
        if (!currentUser || currentUser.role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      // Validate update data - users can't change their own role or ID
      const allowedFields = userId === targetUserId
        ? insertUserSchema.omit({ role: true }).partial().parse(req.body)
        : insertUserSchema.partial().parse(req.body);

      // Hash password if it's being updated
      if (allowedFields.password) {
        allowedFields.password = await bcrypt.hash(allowedFields.password, 10);
      }

      const user = await storage.updateUser(targetUserId, allowedFields);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Don't return password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      // Check for unique constraint violations
      if (error.code === '23505') {
        if (error.constraint === 'users_email_unique') {
          return res.status(409).json({ error: "此電子郵件已被使用" });
        }
        if (error.constraint === 'users_username_unique') {
          return res.status(409).json({ error: "此用戶名已被使用" });
        }
      }
      
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id/role", isAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }
      
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Don't return password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.delete("/api/users/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Sync status endpoint - public read, admin write
  app.get("/api/sync/status", async (req, res) => {
    try {
      const status = await storage.getSyncStatus();
      if (!status) {
        return res.json({
          initialized: false,
          message: "尚未進行首次同步",
        });
      }
      
      res.json({
        initialized: true,
        lastAttempt: status.lastAttempt,
        lastSuccess: status.lastSuccess,
        consecutiveFailures: status.consecutiveFailures,
        cooldownUntil: status.cooldownUntil,
        isPaused: status.isPaused,
        statusMessage: status.statusMessage,
      });
    } catch (error) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  // Diagnostic endpoint - test Google Drive connection
  app.get("/api/diagnostic/drive", isAdmin, async (req, res) => {
    try {
      const { listSubfolders, getOrCreateRootFolder } = await import("./google-drive");

      console.log("[Diagnostic] Testing Google Drive connection...");
      const rootFolderId = await getOrCreateRootFolder();
      console.log(`[Diagnostic] Root folder ID: ${rootFolderId}`);

      const folders = await listSubfolders(rootFolderId);
      console.log(`[Diagnostic] Successfully listed ${folders.length} folders`);

      return res.json({
        success: true,
        message: "Google Drive connection working",
        rootFolderId,
        foldersFound: folders.length,
        folders: folders.map(f => ({ id: f.id, name: f.name })),
      });
    } catch (error) {
      console.error("[Diagnostic] Google Drive connection failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        success: false,
        message: "Google Drive connection failed",
        error: errorMessage,
        hint: "Check GOOGLE_APPLICATION_CREDENTIALS environment variable and service account permissions",
      });
    }
  });

  // Manual sync trigger - any authenticated user can trigger
  app.post("/api/sync/trigger", isAuthenticated, async (req: any, res) => {
    try {
      const username = req.user?.username || 'unknown';
      console.log(`[Manual Sync] User "${username}" triggered manual sync`);
      const result = await storage.performSyncWithTracking(true); // isManual = true
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, message: result.message });
      }
    } catch (error) {
      console.error("Error during manual sync:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message: `同步失敗：${errorMessage}` });
    }
  });

  // Admin endpoint to auto-extract band/album from song filenames
  // Pattern: "BandName_SongTitle.pdf" -> extracts "BandName"
  app.post("/api/admin/songs/extract-band-album", isAdmin, async (req, res) => {
    try {
      console.log("[Admin] Starting band/album extraction from filenames");
      
      // Get all songs
      const allSongs = await storage.getAllSongs();
      const allFiles = await storage.getAllFiles();
      
      // Create a map of songId -> files
      const filesBySongId = new Map<string, typeof allFiles>();
      for (const file of allFiles) {
        if (!filesBySongId.has(file.songId)) {
          filesBySongId.set(file.songId, []);
        }
        filesBySongId.get(file.songId)!.push(file);
      }
      
      let updatedCount = 0;
      let skippedCount = 0;
      let noPatternCount = 0;
      const updates: { songId: string; title: string; extractedBand: string }[] = [];
      
      for (const song of allSongs) {
        // Skip songs that already have bandAlbum set
        if (song.bandAlbum && song.bandAlbum.trim() !== '') {
          skippedCount++;
          continue;
        }
        
        // Get files for this song
        const songFiles = filesBySongId.get(song.id) || [];
        
        // Try to extract band from filename pattern "BandName_SongTitle.ext"
        let extractedBand: string | null = null;
        
        // First, try the song title itself (it might have the pattern)
        if (song.title.includes('_')) {
          const parts = song.title.split('_');
          if (parts.length >= 2 && parts[0].trim().length > 0) {
            extractedBand = parts[0].trim();
          }
        }
        
        // If not found in title, try the file names
        if (!extractedBand && songFiles.length > 0) {
          for (const file of songFiles) {
            // Remove file extension first
            const nameWithoutExt = file.name.replace(/\.(pdf|jpg|jpeg|png|gif)$/i, '');
            
            if (nameWithoutExt.includes('_')) {
              const parts = nameWithoutExt.split('_');
              if (parts.length >= 2 && parts[0].trim().length > 0) {
                extractedBand = parts[0].trim();
                break;
              }
            }
          }
        }
        
        if (extractedBand) {
          // Update the song with extracted band
          await storage.updateSong(song.id, { bandAlbum: extractedBand });
          updatedCount++;
          updates.push({
            songId: song.id,
            title: song.title,
            extractedBand,
          });
          console.log(`[Extract] Updated "${song.title}" -> band: "${extractedBand}"`);
        } else {
          noPatternCount++;
        }
      }
      
      console.log(`[Admin] Band/album extraction complete: ${updatedCount} updated, ${skippedCount} skipped (already set), ${noPatternCount} no pattern found`);
      
      res.json({
        success: true,
        message: `已自動填入 ${updatedCount} 首詩歌的樂團/專輯資訊`,
        stats: {
          updated: updatedCount,
          skipped: skippedCount,
          noPattern: noPatternCount,
          total: allSongs.length,
        },
        updates,
      });
    } catch (error) {
      console.error("Error extracting band/album:", error);
      res.status(500).json({ 
        success: false, 
        error: "自動填入樂團/專輯失敗",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // AI-powered endpoint to generate tags for songs
  // Uses GPT-4o-mini via Replit AI Integrations - charges to Replit credits
  app.post("/api/admin/songs/ai-generate-tags", isAdmin, async (req, res) => {
    try {
      console.log("[Admin AI] Starting AI-powered tag generation");
      
      // Import AI extraction service
      
      // Get all songs
      const allSongs = await storage.getAllSongs();
      
      // Filter songs that don't have tags
      const songsToProcess = allSongs.filter(song => {
        return !song.tags || song.tags.length === 0;
      });
      
      if (songsToProcess.length === 0) {
        return res.json({
          success: true,
          message: "沒有需要 AI 生成標籤的詩歌（所有詩歌都已有標籤）",
          stats: { processed: 0, updated: 0, skipped: allSongs.length }
        });
      }
      
      console.log(`[Admin AI] Found ${songsToProcess.length} songs needing tag generation`);
      
      // Create a map for validation - ensure we only update songs we intended to process
      const validSongIds = new Set(songsToProcess.map(s => s.id));
      
      // Call AI to generate tags
      const aiResults = await generateTagsForSongs(
        songsToProcess.map(s => ({ id: s.id, title: s.title, bandAlbum: s.bandAlbum }))
      );
      
      let updatedCount = 0;
      let skippedByAI = 0;
      const updates: { songId: string; title: string; tags: string[] }[] = [];
      
      for (const result of aiResults) {
        // Validate songId exists in our processed set (defensive check)
        if (!validSongIds.has(result.songId)) {
          console.warn(`[AI Tags] Skipping unknown songId: ${result.songId}`);
          continue;
        }
        
        // Only update if we got valid, non-empty tags
        if (result.tags && Array.isArray(result.tags) && result.tags.length > 0) {
          // Filter out any empty strings
          const validTags = result.tags.filter(t => t && t.trim() !== '');
          if (validTags.length > 0) {
            await storage.updateSong(result.songId, { tags: validTags });
            updatedCount++;
            updates.push({
              songId: result.songId,
              title: result.title,
              tags: validTags
            });
            console.log(`[AI Tags] Updated "${result.title}" -> tags: [${validTags.join(", ")}]`);
          } else {
            skippedByAI++;
          }
        } else {
          skippedByAI++;
        }
      }
      
      console.log(`[Admin AI] Tag generation complete: ${updatedCount} updated, ${skippedByAI} AI could not generate, from ${songsToProcess.length} analyzed`);
      
      res.json({
        success: true,
        message: `AI 已分析 ${songsToProcess.length} 首詩歌，成功生成 ${updatedCount} 首的標籤`,
        stats: {
          analyzed: songsToProcess.length,
          updated: updatedCount,
          aiSkipped: skippedByAI,
          alreadyHasTags: allSongs.length - songsToProcess.length,
          total: allSongs.length
        },
        updates
      });
    } catch (error) {
      console.error("Error in AI tag generation:", error);
      res.status(500).json({
        success: false,
        error: "AI 標籤生成失敗",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Health check endpoint - for monitoring and deployment readiness
  app.get("/api/health", async (req, res) => {
    try {
      const status = await storage.getSyncStatus();
      
      // If never synced successfully, return 503 (service unavailable)
      if (!status || !status.lastSuccess) {
        return res.status(503).json({
          healthy: false,
          message: "等待首次 Google Drive 同步",
          status: "uninitialized",
        });
      }

      // Check if last successful sync was within acceptable window (24 hours)
      const now = new Date();
      const hoursSinceLastSuccess = (now.getTime() - status.lastSuccess.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastSuccess > 24) {
        return res.status(503).json({
          healthy: false,
          message: "同步數據已過期",
          status: "stale",
          lastSuccess: status.lastSuccess,
        });
      }

      // All good
      res.json({
        healthy: true,
        message: "服務正常運行",
        status: "healthy",
        lastSuccess: status.lastSuccess,
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        healthy: false,
        message: "健康檢查失敗",
        status: "error",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
