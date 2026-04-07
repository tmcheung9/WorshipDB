import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table with username/password authentication + roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(), // Hashed password
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("user"), // user, admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Categories table - synced from Google Drive subfolders or manually created
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  driveId: text("drive_id").unique(), // Google Drive folder ID (nullable for manual categories)
  isManual: boolean("is_manual").notNull().default(false), // true if created manually (not from sync)
  isOrphaned: boolean("is_orphaned").notNull().default(false), // true if Drive folder is inaccessible/deleted
  lastSynced: timestamp("last_synced").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  lastSynced: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Songs table with metadata (simplified)
export const songs = pgTable("songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // 詩歌名稱 (mandatory)
  categoryId: varchar("category_id").references(() => categories.id), // 分類 (mandatory)
  bandAlbum: text("band_album"), // 樂團/專輯 (optional, combined field)
  tags: text("tags").array(), // 標籤 (optional, array of tags)
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songs.$inferSelect;

// Files table - multiple files per song (different versions, arrangements, formats)
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  driveId: text("drive_id").notNull(), // Google Drive file ID (not unique - same file can be in multiple songs)
  mimeType: text("mime_type").notNull(),
  size: integer("size"), // File size in bytes
  thumbnailUrl: text("thumbnail_url"),
  webViewLink: text("web_view_link"),
  webContentLink: text("web_content_link"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// Sync status table - tracks Google Drive sync state for reliability
export const syncStatus = pgTable("sync_status", {
  id: varchar("id").primaryKey(), // Always "googleDrive" - single row
  lastAttempt: timestamp("last_attempt"), // Last sync attempt time
  lastSuccess: timestamp("last_success"), // Last successful sync time
  consecutiveFailures: integer("consecutive_failures").notNull().default(0), // Count of consecutive failures
  cooldownUntil: timestamp("cooldown_until"), // Don't retry until this time
  statusMessage: text("status_message"), // Human-readable status
  isPaused: boolean("is_paused").notNull().default(false), // Paused after too many failures
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSyncStatusSchema = createInsertSchema(syncStatus).omit({
  updatedAt: true,
});

export type InsertSyncStatus = z.infer<typeof insertSyncStatusSchema>;
export type SyncStatus = typeof syncStatus.$inferSelect;

// Deleted files tracking - prevents sync from re-adding intentionally deleted files
export const deletedDriveIds = pgTable("deleted_drive_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driveId: text("drive_id").notNull().unique(), // Google Drive file/folder ID that was deleted
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  deletedBy: varchar("deleted_by").references(() => users.id),
});

export const insertDeletedDriveIdSchema = createInsertSchema(deletedDriveIds).omit({
  id: true,
  deletedAt: true,
});

export type InsertDeletedDriveId = z.infer<typeof insertDeletedDriveIdSchema>;
export type DeletedDriveId = typeof deletedDriveIds.$inferSelect;
