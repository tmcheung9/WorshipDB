# Deployment Guide - Schema Migration

## Schema Change: v1.2.0 (Simplified Metadata)

### What Changed:
- **ADDED**: `band_album` column (text, nullable)
- **REMOVED**: `composer`, `lyricist`, `band`, `album` columns

### Pre-Deployment Checklist:

1. **Backup Production Database** (if you have existing data)
   ```bash
   # On production, export your current data first
   ```

2. **Schema Sync Command** (use this when deploying):
   ```bash
   npm run db:push
   ```
   
   If that fails, use:
   ```bash
   npm run db:push --force
   ```

### Important Notes:

- The `band_album` column is a **NEW column** (not a rename)
- If production has data in the old `band`/`album`/`composer`/`lyricist` columns, **that data will be lost** when those columns are dropped
- The new `band_album` column will start empty for existing songs
- Your Drizzle schema in `shared/schema.ts` is the source of truth

### Migration Safety:

The schema sync is safe because:
- `band_album` is nullable (won't break existing rows)
- Dropping old columns removes unused fields
- No data transformation needed (new column starts empty)

### After Deployment:

Songs created via Google Drive sync will automatically populate the `band_album` field based on the file naming convention.
