import { db } from "./db";
import { eq, like, or, and, sql, desc, inArray } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type UpsertUser,
  users,
  type Category,
  type InsertCategory,
  categories,
  type Song,
  type InsertSong,
  songs,
  type File,
  type InsertFile,
  files,
  type SyncStatus,
  type InsertSyncStatus,
  syncStatus,
  type DeletedDriveId,
  deletedDriveIds,
} from "@shared/schema";
import { listSubfolders, getOrCreateRootFolder, listFilesInFolder } from "./google-drive";

// Constants for exponential backoff
const BACKOFF_BASE_MS = 60 * 1000; // 1 minute
const BACKOFF_MAX_MS = 60 * 60 * 1000; // 1 hour
const MAX_FAILURES_BEFORE_PAUSE = 5;

// Helper function to calculate exponential backoff delay
function calculateBackoffDelay(consecutiveFailures: number): number {
  const delay = BACKOFF_BASE_MS * Math.pow(2, consecutiveFailures);
  return Math.min(delay, BACKOFF_MAX_MS);
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Additional user methods
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;

  // Category methods (synced from Google Drive and manual CRUD)
  syncCategoriesFromDrive(): Promise<Category[]>;
  getAllCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  getCategoryByDriveId(driveId: string): Promise<Category | undefined>;
  
  // Admin category CRUD methods (for manual categories)
  createCategory(name: string, driveId?: string | null): Promise<Category>;
  updateCategory(id: string, data: { name?: string; driveId?: string | null }): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<{ success: boolean; message: string }>;
  
  // Sync songs and files from Google Drive
  syncSongsFromDrive(): Promise<void>;

  // Song methods
  getAllSongs(): Promise<Song[]>;
  getSongById(id: string): Promise<Song | undefined>;
  getSongsByCategoryId(categoryId: string): Promise<Song[]>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, song: Partial<InsertSong>): Promise<Song | undefined>;
  deleteSong(id: string): Promise<void>;
  searchSongs(query: string, categoryId?: string): Promise<Song[]>;

  // File methods
  getAllFiles(): Promise<File[]>;
  getFileById(id: string): Promise<File | undefined>;
  getFileByDriveId(driveId: string): Promise<File | undefined>;
  getFilesBySongId(songId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  deleteFile(id: string): Promise<void>;
  deleteFilesByDriveId(driveId: string): Promise<void>;

  // Sync status methods for reliability
  getSyncStatus(): Promise<SyncStatus | undefined>;
  updateSyncStatus(status: Partial<InsertSyncStatus>): Promise<SyncStatus>;
  canAttemptSync(): Promise<{ allowed: boolean; reason?: string }>;
  performSyncWithTracking(isManual?: boolean): Promise<{ success: boolean; message: string }>;
  
  // Deleted drive IDs tracking - prevents re-sync of deleted files
  trackDeletedDriveId(driveId: string, deletedBy?: string): Promise<void>;
  isDeletedDriveId(driveId: string): Promise<boolean>;
  getDeletedDriveIds(): Promise<Set<string>>;
  clearDeletedDriveId(driveId: string): Promise<boolean>;
  clearAllDeletedDriveIds(): Promise<number>;
}

export class DbStorage implements IStorage {
  private syncInProgress = false;
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    // Never return password from storage layer
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    }
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    // Never return password from storage layer
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  // Additional user methods
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    // Never return password from storage layer
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async getAllUsers(): Promise<User[]> {
    const usersWithPasswords = await db.select().from(users).orderBy(desc(users.createdAt));
    // Strip passwords from all users
    return usersWithPasswords.map(({ password: _, ...user }) => user as User);
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    // Never return password from storage layer
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    }
    return undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    // Never return password from storage layer
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    }
    return undefined;
  }

  // Category methods (synced from Google Drive)
  async syncCategoriesFromDrive(): Promise<Category[]> {
    try {
      const rootFolderId = await getOrCreateRootFolder();
      console.log(`[Category Sync] Root folder ID: ${rootFolderId}`);
      
      const driveFolders = await listSubfolders(rootFolderId);
      console.log(`[Category Sync] Found ${driveFolders.length} subfolders in Google Drive:`, driveFolders.map(f => f.name));

      // Get existing categories from database
      const existingCategories = await db.select().from(categories);
      console.log(`[Category Sync] Existing categories in DB: ${existingCategories.length}`);
      
      // Create maps for quick lookup
      const existingByDriveId = new Map(existingCategories.map((c: Category) => [c.driveId, c]));
      const existingDriveIds = new Set(existingCategories.map((c: Category) => c.driveId));
      const driveFolderIds = new Set(driveFolders.map(f => f.id));

      // Insert new categories
      const newFolders = driveFolders.filter((f) => !existingDriveIds.has(f.id));
      console.log(`[Category Sync] New folders to insert: ${newFolders.length}`);
      if (newFolders.length > 0) {
        await db.insert(categories).values(
          newFolders.map((f) => ({
            name: f.name,
            driveId: f.id,
          }))
        );
        console.log(`[Category Sync] Inserted ${newFolders.length} new categories:`, newFolders.map(f => f.name));
      }

      // Update existing categories: sync name changes and lastSynced timestamp
      let updatedCount = 0;
      let renamedCategories: string[] = [];
      
      for (const driveFolder of driveFolders) {
        const existingCategory = existingByDriveId.get(driveFolder.id);
        if (existingCategory) {
          // Check if name changed
          const nameChanged = existingCategory.name !== driveFolder.name;
          if (nameChanged) {
            renamedCategories.push(`${existingCategory.name} -> ${driveFolder.name}`);
          }
          
          // Always update lastSynced, and name if changed
          await db
            .update(categories)
            .set({ 
              name: driveFolder.name,  // Always sync name from Google Drive
              lastSynced: new Date() 
            })
            .where(eq(categories.driveId, driveFolder.id));
          
          if (nameChanged) {
            updatedCount++;
          }
        }
      }
      
      if (renamedCategories.length > 0) {
        console.log(`[Category Sync] Updated ${updatedCount} category names:`, renamedCategories);
      }

      // ORPHAN DETECTION: Mark categories as orphaned when their Drive folders are not accessible
      // This allows admins to clean them up manually without destructive auto-delete
      const syncedCategories = existingCategories.filter((c: Category) => !c.isManual && c.driveId);
      const orphanedCategories = syncedCategories.filter((c: Category) => !driveFolderIds.has(c.driveId!));
      const accessibleCategories = syncedCategories.filter((c: Category) => driveFolderIds.has(c.driveId!));
      
      // SAFEGUARD: Only process orphan detection if Drive returned at least one folder
      // This prevents mass orphan marking during transient API failures or auth issues
      if (driveFolders.length === 0 && syncedCategories.length > 0) {
        console.log(`[Category Sync] ⚠️ Skipping orphan detection - Drive returned 0 folders but we have ${syncedCategories.length} synced categories`);
        console.log(`[Category Sync] ⚠️ This may indicate an API failure or OAuth scope issue - not marking any categories as orphaned`);
      } else {
        // Mark orphaned categories (Drive folder not accessible)
        if (orphanedCategories.length > 0) {
          console.log(`[Category Sync] ℹ️ Found ${orphanedCategories.length} categories with inaccessible Drive folders - marking as orphaned`);
          for (const category of orphanedCategories) {
            if (!category.isOrphaned) {
              await db
                .update(categories)
                .set({ isOrphaned: true, lastSynced: new Date() })
                .where(eq(categories.id, category.id));
              console.log(`[Category Sync] Marked as orphaned: ${category.name}`);
            }
          }
        }
        
        // Un-mark categories that are now accessible (folder restored or scope fixed)
        for (const category of accessibleCategories) {
          if (category.isOrphaned) {
            await db
              .update(categories)
              .set({ isOrphaned: false, lastSynced: new Date() })
              .where(eq(categories.id, category.id));
            console.log(`[Category Sync] Restored from orphaned: ${category.name}`);
          }
        }
      }
      
      // Log manual categories count
      const manualCategories = existingCategories.filter((c: Category) => c.isManual);
      if (manualCategories.length > 0) {
        console.log(`[Category Sync] ℹ️ ${manualCategories.length} manual categories preserved (not affected by sync)`);
      }
      
      // DESTRUCTIVE SYNC FEATURE FLAG
      // Set to true ONLY after re-authenticating Google Drive with 'drive.readonly' or 'drive' scope
      // and confirming all folders are visible (currently only 9 of 25+ are visible due to drive.file scope)
      const ENABLE_DESTRUCTIVE_SYNC = false;
      
      // Remove categories that no longer exist in Google Drive (true sync)
      // Multiple safety checks to prevent accidental mass deletion
      let deletedCount = 0;
      let deletedCategories: string[] = [];
      
      if (!ENABLE_DESTRUCTIVE_SYNC) {
        if (orphanedCategories.length > 0) {
          console.log(`[Category Sync] ℹ️ DESTRUCTIVE_SYNC disabled - ${orphanedCategories.length} orphaned categories can be cleaned up manually via admin`);
        }
      } else if (driveFolders.length > 0) {
        // Find non-manual categories in DB that are not in Google Drive anymore
        // Manual categories are never deleted by sync
        const syncedCategories = existingCategories.filter((c: Category) => !c.isManual && c.driveId);
        const categoriesToDelete = syncedCategories.filter((c: Category) => !driveFolderIds.has(c.driveId!));
        
        if (categoriesToDelete.length > 0) {
          // SAFETY THRESHOLD: Abort if deletion would remove more than 50% of synced categories
          // This protects against OAuth scope limitations (drive.file only sees partial folders)
          // or API issues that return incomplete folder lists
          // Note: Only consider synced categories (manual categories are excluded from this calculation)
          const deletionPercentage = (categoriesToDelete.length / syncedCategories.length) * 100;
          const SAFE_DELETION_THRESHOLD = 50; // Maximum % of synced categories that can be deleted at once
          
          if (deletionPercentage > SAFE_DELETION_THRESHOLD) {
            console.log(`[Category Sync] ⚠️ SAFETY BLOCK: Would delete ${categoriesToDelete.length} of ${existingCategories.length} categories (${deletionPercentage.toFixed(1)}%)`);
            console.log(`[Category Sync] This exceeds the ${SAFE_DELETION_THRESHOLD}% safety threshold - deletion aborted`);
            console.log(`[Category Sync] This is likely due to OAuth scope limitation (drive.file only sees app-created folders)`);
            console.log(`[Category Sync] To fix: Re-authenticate Google Drive with 'drive.readonly' or 'drive' scope`);
            console.log(`[Category Sync] Categories that would be deleted:`, categoriesToDelete.map(c => c.name));
          } else {
            console.log(`[Category Sync] Found ${categoriesToDelete.length} categories to remove (${deletionPercentage.toFixed(1)}% - within safe threshold)`);
            
            for (const categoryToDelete of categoriesToDelete) {
              deletedCategories.push(categoryToDelete.name);
              
              // First, delete all files associated with songs in this category
              const songsInCategory = await db.select().from(songs).where(eq(songs.categoryId, categoryToDelete.id));
              for (const song of songsInCategory) {
                await db.delete(files).where(eq(files.songId, song.id));
              }
              
              // Then, delete all songs in this category
              await db.delete(songs).where(eq(songs.categoryId, categoryToDelete.id));
              
              // Finally, delete the category
              await db.delete(categories).where(eq(categories.id, categoryToDelete.id));
              
              deletedCount++;
            }
            
            console.log(`[Category Sync] Removed ${deletedCount} categories:`, deletedCategories);
          }
        }
      } else {
        console.log(`[Category Sync] WARNING: No folders returned from Google Drive - skipping deletion to prevent data loss`);
        console.log(`[Category Sync] This may be due to OAuth scope limitations (drive.file only sees app-created folders)`);
      }

      // Get all categories after sync
      const allCategories = await db.select().from(categories);
      console.log(`[Category Sync] Total categories after sync: ${allCategories.length}`);
      
      // Summary log
      console.log(`[Category Sync] Summary: ${newFolders.length} new, ${updatedCount} renamed, ${deletedCount} removed, ${allCategories.length} total`);
      
      return allCategories;
    } catch (error) {
      console.error("[Category Sync] Error syncing categories from Drive:", error);
      // Return existing categories if sync fails
      return await db.select().from(categories);
    }
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryByDriveId(driveId: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.driveId, driveId));
    return category;
  }

  // Admin category CRUD methods (for manual categories)
  async createCategory(name: string, driveId?: string | null): Promise<Category> {
    const isManual = !driveId; // Manual if no driveId
    const [category] = await db
      .insert(categories)
      .values({
        name,
        driveId: driveId || null,
        isManual,
        lastSynced: new Date(),
      })
      .returning();
    console.log(`[Category] Created ${isManual ? 'manual' : 'synced'} category: ${name}`);
    return category;
  }

  async updateCategory(id: string, data: { name?: string; driveId?: string | null }): Promise<Category | undefined> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.driveId !== undefined) {
      updateData.driveId = data.driveId;
      updateData.isManual = !data.driveId; // Update isManual based on driveId
    }
    
    const [category] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();
    
    if (category) {
      console.log(`[Category] Updated category: ${category.name}`);
    }
    return category;
  }

  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    const category = await this.getCategoryById(id);
    if (!category) {
      return { success: false, message: "分類不存在" };
    }

    // Check if category has songs
    const songsInCategory = await db.select().from(songs).where(eq(songs.categoryId, id));
    if (songsInCategory.length > 0) {
      return { 
        success: false, 
        message: `無法刪除：此分類包含 ${songsInCategory.length} 首詩歌。請先移除或轉移這些詩歌。` 
      };
    }

    // For empty categories, allow deletion in these cases:
    // 1. Manual categories (isManual=true) - always deletable
    // 2. Categories without driveId - always deletable
    // 3. Force delete via admin is allowed for orphaned categories (empty with driveId but no songs)
    // Note: We allow deleting empty synced categories to clean up orphaned data
    // The sync will recreate them if the folder still exists in Google Drive
    
    await db.delete(categories).where(eq(categories.id, id));
    console.log(`[Category] Deleted category: ${category.name} (isManual: ${category.isManual}, driveId: ${category.driveId || 'none'})`);
    return { success: true, message: "分類已刪除" };
  }

  // Clean up an orphaned category - deletes all songs/files and the category itself
  async cleanupOrphanedCategory(id: string): Promise<{ success: boolean; message: string; deletedSongs: number; deletedFiles: number }> {
    const category = await this.getCategoryById(id);
    if (!category) {
      return { success: false, message: "分類不存在", deletedSongs: 0, deletedFiles: 0 };
    }

    // Only allow cleanup of orphaned synced categories (not manual categories)
    if (category.isManual) {
      return { 
        success: false, 
        message: "無法清除手動分類。請直接刪除。",
        deletedSongs: 0,
        deletedFiles: 0
      };
    }

    if (!category.isOrphaned) {
      return { 
        success: false, 
        message: "此分類不是孤立分類，無法執行清除操作。",
        deletedSongs: 0,
        deletedFiles: 0
      };
    }

    // Get all songs in this category
    const songsInCategory = await db.select().from(songs).where(eq(songs.categoryId, id));
    let deletedFilesCount = 0;

    // Delete all files associated with songs in this category
    for (const song of songsInCategory) {
      const filesInSong = await db.select().from(files).where(eq(files.songId, song.id));
      deletedFilesCount += filesInSong.length;
      await db.delete(files).where(eq(files.songId, song.id));
    }

    // Delete all songs in this category
    await db.delete(songs).where(eq(songs.categoryId, id));
    const deletedSongsCount = songsInCategory.length;

    // Delete the category
    await db.delete(categories).where(eq(categories.id, id));

    console.log(`[Category Cleanup] Cleaned up orphaned category: ${category.name}`);
    console.log(`[Category Cleanup] Deleted ${deletedSongsCount} songs and ${deletedFilesCount} files`);

    return { 
      success: true, 
      message: `已清除分類「${category.name}」及其 ${deletedSongsCount} 首詩歌和 ${deletedFilesCount} 個檔案`,
      deletedSongs: deletedSongsCount,
      deletedFiles: deletedFilesCount
    };
  }

  // Sync songs and files from Google Drive
  async syncSongsFromDrive(): Promise<void> {
    try {
      console.log('[Sync] Starting song sync from Google Drive');
      
      // Get all deleted drive IDs to filter out during sync
      const deletedIds = await this.getDeletedDriveIds();
      console.log(`[Sync] Found ${deletedIds.size} deleted driveIds to skip`);
      
      // Get all categories
      const allCategories = await db.select().from(categories);
      console.log(`[Sync] Found ${allCategories.length} categories to scan`);
      
      for (const category of allCategories) {
        // Skip categories without a driveId (manual categories)
        if (!category.driveId) {
          console.log(`[Sync] Skipping manual category: ${category.name} (no driveId)`);
          continue;
        }
        
        console.log(`[Sync] Scanning category: ${category.name} (${category.driveId})`);
        
        // List all files in this category folder
        const allDriveFiles = await listFilesInFolder(category.driveId);
        
        // Filter out deleted files - these were intentionally removed by admin
        const driveFiles = allDriveFiles.filter((f: any) => !deletedIds.has(f.id));
        const skippedCount = allDriveFiles.length - driveFiles.length;
        
        console.log(`[Sync] Found ${allDriveFiles.length} files in ${category.name}, skipping ${skippedCount} deleted files`);
        
        // Group files by song name (remove file extension)
        const songGroups = new Map<string, typeof driveFiles>();
        
        for (const file of driveFiles) {
          // Extract song name from filename (remove extension)
          const songName = file.name.replace(/\.(pdf|jpg|jpeg|png|gif)$/i, '').trim();
          
          if (!songGroups.has(songName)) {
            songGroups.set(songName, []);
          }
          songGroups.get(songName)!.push(file);
        }
        
        console.log(`[Sync] Grouped into ${songGroups.size} songs`);
        
        // Create or update songs
        for (const [songName, songFiles] of Array.from(songGroups.entries())) {
          // Check if song already exists
          const existingSongs = await db
            .select()
            .from(songs)
            .where(and(
              eq(songs.title, songName),
              eq(songs.categoryId, category.id)
            ));
          
          let song: Song;
          
          if (existingSongs.length > 0) {
            // Song exists, use it - NEVER overwrite existing metadata (bandAlbum, tags)
            song = existingSongs[0];
            const hasMetadata = song.bandAlbum || (song.tags && song.tags.length > 0);
            console.log(`[Sync] Song already exists: ${songName}${hasMetadata ? ' (preserving existing metadata)' : ''}`);
          } else {
            // Before creating a new song, check if any of the files already exist
            // This helps preserve metadata when song titles change slightly
            const fileDriveIds = songFiles.map((f: any) => f.id);
            let inheritedBandAlbum: string | null = null;
            let inheritedTags: string[] | null = null;
            
            if (fileDriveIds.length > 0) {
              const existingFilesWithSameIds = await db.select().from(files).where(inArray(files.driveId, fileDriveIds));
              if (existingFilesWithSameIds.length > 0) {
                // Get the song that has these files and copy its metadata
                const existingSongWithFiles = await db.select().from(songs).where(eq(songs.id, existingFilesWithSameIds[0].songId));
                if (existingSongWithFiles.length > 0 && (existingSongWithFiles[0].bandAlbum || existingSongWithFiles[0].tags)) {
                  inheritedBandAlbum = existingSongWithFiles[0].bandAlbum;
                  inheritedTags = existingSongWithFiles[0].tags;
                  console.log(`[Sync] Inheriting metadata from existing song with same files: bandAlbum="${inheritedBandAlbum}", tags=${JSON.stringify(inheritedTags)}`);
                }
              }
            }
            
            // Create new song - inherit metadata if found, otherwise null
            const [newSong] = await db.insert(songs).values({
              title: songName,
              categoryId: category.id,
              bandAlbum: inheritedBandAlbum, // Inherited or null - will be extracted by AI or manually entered
              tags: inheritedTags, // Inherited or null - can be added manually or extracted by AI
            }).returning();
            song = newSong;
            console.log(`[Sync] Created new song: ${songName}${inheritedBandAlbum || inheritedTags ? ' (with inherited metadata)' : ''}`);
          }
          
          // Get existing files for this specific song only
          // We now allow the same driveId to exist across multiple songs
          const existingFilesForSong = await db.select().from(files).where(eq(files.songId, song.id));
          const existingDriveIdsForSong = new Set(existingFilesForSong.map((f: File) => f.driveId));
          
          // Add files that don't already exist for THIS song (allow duplicates across songs)
          const newFiles = songFiles.filter((f: any) => !existingDriveIdsForSong.has(f.id));
          
          if (newFiles.length > 0) {
            await db.insert(files).values(
              newFiles.map((file: any) => ({
                songId: song.id,
                driveId: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size || null,
                webViewLink: file.webViewLink || null,
                webContentLink: file.webContentLink || null,
                thumbnailLink: file.thumbnailLink || null,
              }))
            );
            console.log(`[Sync] Added ${newFiles.length} files to song: ${songName}`);
          }
          
          // DESTRUCTIVE SYNC: Remove files that no longer exist in Google Drive
          // This is disabled by default to prevent data loss due to OAuth scope limitations
          // Enable ONLY after fixing OAuth scope to drive.readonly or drive
          const ENABLE_FILE_DESTRUCTIVE_SYNC = false;
          
          if (ENABLE_FILE_DESTRUCTIVE_SYNC) {
            const driveFileIds = new Set(songFiles.map((f: any) => f.id));
            const filesToRemove = existingFilesForSong.filter((f: File) => !driveFileIds.has(f.driveId));
            
            if (filesToRemove.length > 0 && songFiles.length > 0) {
              // Only delete if we got some files back from Drive (not empty response)
              for (const fileToRemove of filesToRemove) {
                await db.delete(files).where(eq(files.id, fileToRemove.id));
              }
              console.log(`[Sync] Removed ${filesToRemove.length} orphan files from song "${songName}" (no longer in Google Drive)`);
            } else if (filesToRemove.length > 0 && songFiles.length === 0) {
              console.log(`[Sync] ⚠️ SAFETY SKIP: Would remove ${filesToRemove.length} files from "${songName}" but Drive returned 0 files - skipping`);
            }
          }
        }
        
        // Note: We do NOT automatically remove songs that have no files
        // Songs may have files in Drive that we can't see due to OAuth scope limitations
        // Empty song cleanup should only happen if we're confident the files were truly deleted
      }
      
      console.log('[Sync] Song sync completed');
    } catch (error) {
      console.error('Error syncing songs from Drive:', error);
      throw error;
    }
  }

  // Song methods
  async getAllSongs(): Promise<Song[]> {
    return await db.select().from(songs).orderBy(desc(songs.createdAt));
  }

  async getSongById(id: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    return song;
  }

  async getSongsByCategoryId(categoryId: string): Promise<Song[]> {
    return await db.select().from(songs).where(eq(songs.categoryId, categoryId));
  }

  async createSong(insertSong: InsertSong): Promise<Song> {
    const [song] = await db.insert(songs).values(insertSong).returning();
    return song;
  }

  async updateSong(id: string, updateData: Partial<InsertSong>): Promise<Song | undefined> {
    const [song] = await db
      .update(songs)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(songs.id, id))
      .returning();
    return song;
  }

  async deleteSong(id: string): Promise<void> {
    // Google Drive is the single source of truth
    // We only delete the database record, NOT the actual file in Google Drive
    // The song will reappear on next sync if the file still exists in Drive
    
    // Delete the song from database (cascade will delete file records)
    await db.delete(songs).where(eq(songs.id, id));
    console.log(`[Delete Song] Deleted song from database: ${id} (Google Drive files preserved)`);
  }

  async searchSongs(query: string, categoryId?: string): Promise<Song[]> {
    const searchPattern = `%${query}%`;
    
    let conditions = or(
      like(songs.title, searchPattern),
      like(songs.bandAlbum, searchPattern)
    );

    if (categoryId) {
      conditions = and(conditions, eq(songs.categoryId, categoryId));
    }

    return await db.select().from(songs).where(conditions).orderBy(desc(songs.createdAt));
  }

  // File methods
  async getAllFiles(): Promise<File[]> {
    return await db.select().from(files);
  }

  async getFileById(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async getFileByDriveId(driveId: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.driveId, driveId));
    return file;
  }

  async getFilesBySongId(songId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.songId, songId));
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values(insertFile).returning();
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async deleteFilesByDriveId(driveId: string): Promise<void> {
    await db.delete(files).where(eq(files.driveId, driveId));
  }

  // Sync status methods for reliability
  async getSyncStatus(): Promise<SyncStatus | undefined> {
    const [status] = await db.select().from(syncStatus).where(eq(syncStatus.id, "googleDrive"));
    return status;
  }

  async updateSyncStatus(statusUpdate: Partial<InsertSyncStatus>): Promise<SyncStatus> {
    const now = new Date();
    
    // Always ensure the googleDrive row exists
    const [status] = await db
      .insert(syncStatus)
      .values({
        id: "googleDrive",
        ...statusUpdate,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: syncStatus.id,
        set: {
          ...statusUpdate,
          updatedAt: now,
        },
      })
      .returning();
    
    return status;
  }

  async canAttemptSync(): Promise<{ allowed: boolean; reason?: string }> {
    const status = await this.getSyncStatus();
    const now = new Date();
    
    // First sync - always allow
    if (!status) {
      return { allowed: true };
    }

    // If paused (too many failures), only manual sync allowed
    if (status.isPaused) {
      return { 
        allowed: false, 
        reason: `同步已暫停（${status.consecutiveFailures} 次連續失敗）。請使用管理控制台手動觸發同步。` 
      };
    }

    // Check cooldown period
    if (status.cooldownUntil && status.cooldownUntil > now) {
      const minutesRemaining = Math.ceil((status.cooldownUntil.getTime() - now.getTime()) / 60000);
      return { 
        allowed: false, 
        reason: `冷卻期間 - 請等待 ${minutesRemaining} 分鐘後再試` 
      };
    }

    return { allowed: true };
  }

  private async performSyncLogic(isManual: boolean, now: Date): Promise<{ success: boolean; message: string }> {
    // If manual sync, immediately reset failure counters and cooldown before attempting
    if (isManual) {
      console.log("[Sync Tracking] Manual sync triggered - resetting failure counters and cooldown");
      await this.updateSyncStatus({
        lastAttempt: now,
        consecutiveFailures: 0,
        cooldownUntil: null,
        isPaused: false,
        statusMessage: "手動同步進行中",
      });
    } else {
      // For automatic sync, check if sync is allowed
      const checkResult = await this.canAttemptSync();
      if (!checkResult.allowed) {
        return { success: false, message: checkResult.reason || "同步被阻止" };
      }
      
      // Mark sync attempt
      await this.updateSyncStatus({
        lastAttempt: now,
      });
    }

    try {
      // Perform the actual sync
      console.log("[Sync Tracking] Starting Google Drive sync...");
      await this.syncCategoriesFromDrive();
      await this.syncSongsFromDrive();
      console.log("[Sync Tracking] Sync completed successfully");

      // Success - reset failure counters
      try {
        await this.updateSyncStatus({
          lastSuccess: now,
          consecutiveFailures: 0,
          cooldownUntil: null,
          isPaused: false,
          statusMessage: "同步成功",
        });
      } catch (statusError) {
        console.error("[Sync Tracking] Failed to update success status:", statusError);
        // Don't throw - sync succeeded even if status write failed
      }

      return { success: true, message: "Google Drive 同步成功" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Sync Tracking] Sync failed:", errorMessage);

      if (isManual) {
        // Manual sync failure: Log error but don't apply backoff/cooldown
        // This allows admins to immediately retry after investigating/fixing issues
        try {
          await this.updateSyncStatus({
            statusMessage: `手動同步失敗：${errorMessage}`,
          });
        } catch (statusError) {
          console.error("[Sync Tracking] Failed to update manual failure status:", statusError);
          // Don't throw - allow retry even if status write failed
        }

        return { 
          success: false, 
          message: `手動同步失敗：${errorMessage}。您可以立即重試。` 
        };
      } else {
        // Automatic sync failure: Apply exponential backoff
        try {
          const currentStatus = await this.getSyncStatus();
          const newFailureCount = (currentStatus?.consecutiveFailures || 0) + 1;
          
          // Calculate cooldown based on exponential backoff
          const backoffMs = calculateBackoffDelay(newFailureCount);
          const cooldownUntil = new Date(now.getTime() + backoffMs);

          // Pause if too many failures
          const shouldPause = newFailureCount >= MAX_FAILURES_BEFORE_PAUSE;

          await this.updateSyncStatus({
            consecutiveFailures: newFailureCount,
            cooldownUntil: shouldPause ? null : cooldownUntil,
            isPaused: shouldPause,
            statusMessage: shouldPause 
              ? `同步已暫停（${newFailureCount} 次連續失敗）` 
              : `同步失敗 - 將在 ${Math.ceil(backoffMs / 60000)} 分鐘後重試`,
          });

          return { 
            success: false, 
            message: shouldPause 
              ? `同步失敗並已暫停（${newFailureCount} 次連續失敗）。請修復問題後手動觸發同步。`
              : `同步失敗 - 將在 ${Math.ceil(backoffMs / 60000)} 分鐘後自動重試`
          };
        } catch (statusError) {
          console.error("[Sync Tracking] Failed to update automatic failure status:", statusError);
          // Return error message even if status write failed
          return {
            success: false,
            message: `同步失敗：${errorMessage}（狀態更新也失敗）`
          };
        }
      }
    }
  }

  async performSyncWithTracking(isManual = false): Promise<{ success: boolean; message: string }> {
    // Prevent concurrent syncs
    if (this.syncInProgress) {
      return { 
        success: false, 
        message: "同步已在進行中，請等待當前同步完成" 
      };
    }

    this.syncInProgress = true;
    try {
      // Delegate to helper method - all sync logic is there
      const result = await this.performSyncLogic(isManual, new Date());
      return result;
    } finally {
      // CRITICAL: Always release lock - guaranteed by finally block
      this.syncInProgress = false;
    }
  }

  // Deleted drive IDs tracking - prevents re-sync of deleted files
  async trackDeletedDriveId(driveId: string, deletedBy?: string): Promise<void> {
    try {
      await db.insert(deletedDriveIds).values({
        driveId,
        deletedBy,
      }).onConflictDoNothing();
      console.log(`[Deleted Tracking] Tracked deleted driveId: ${driveId}`);
    } catch (error) {
      console.error(`[Deleted Tracking] Failed to track deleted driveId: ${driveId}`, error);
      // Don't throw - tracking failure shouldn't block deletion
    }
  }

  async isDeletedDriveId(driveId: string): Promise<boolean> {
    const [result] = await db.select().from(deletedDriveIds).where(eq(deletedDriveIds.driveId, driveId));
    return !!result;
  }

  async getDeletedDriveIds(): Promise<Set<string>> {
    const results = await db.select({ driveId: deletedDriveIds.driveId }).from(deletedDriveIds);
    return new Set(results.map(r => r.driveId));
  }

  async clearDeletedDriveId(driveId: string): Promise<boolean> {
    const result = await db.delete(deletedDriveIds).where(eq(deletedDriveIds.driveId, driveId));
    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      console.log(`[Deleted Tracking] Cleared deleted driveId: ${driveId}`);
    }
    return deleted;
  }

  async clearAllDeletedDriveIds(): Promise<number> {
    const result = await db.delete(deletedDriveIds);
    const count = result.rowCount ?? 0;
    console.log(`[Deleted Tracking] Cleared all ${count} deleted driveIds`);
    return count;
  }
}

export const storage = new DbStorage();
