# The REAL Issue: Google Drive Authentication on Cloud Run

## Discovery

After analyzing the code deeply, I found:

**The file `/tmp/cc-agent/65450763/project/server/google-drive.ts` is using `google.auth.GoogleAuth` with default credential lookup.**

This means:
- It attempts to use **service account credentials** automatically on Cloud Run
- It does NOT use Replit Connectors (won't work on Replit)
- It does NOT use OAuth2 refresh tokens

## Why Images Aren't Loading - The Actual Reason

### The Problem Chain

1. **Frontend requests image**: `GET /api/files/{fileId}/content`

2. **Server looks up file in DB**: Gets `driveId` ✓

3. **Server tries to initialize Google Drive client**:
   ```javascript
   const auth = new google.auth.GoogleAuth({
     scopes: ['https://www.googleapis.com/auth/drive.file']
   });
   ```

4. **On Cloud Run**, this tries to find credentials by looking for:
   - Environment variable: `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON key file)
   - Or: Service account metadata from Cloud Run runtime
   - Or: Default Application Credentials (ADC)

5. **If NO credentials found** → `Error: Google Drive not configured`

6. **Image fails to load** → 500 error

## The Missing Piece: Service Account Credentials on Cloud Run

For Cloud Run, you need ONE of these:

### Option 1: Service Account Key File (Simplest for Replit + Cloud Run Parity)

1. Go to Google Cloud Console
2. APIs & Services → Service Accounts
3. Create or select a service account
4. Create a new JSON key
5. Download the key file
6. Set environment variable on both Replit and Cloud Run:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```
7. Upload the key file to your project

### Option 2: Cloud Run Default Service Account (Simpler)

The service account already runs Cloud Run, but it needs permissions:

1. Go to Cloud Run service detail
2. Note the service account email (usually: `project-number-compute@developer.gserviceaccount.com`)
3. Go to Google Cloud Console → APIs & Services
4. Enable: "Google Drive API"
5. Go to Service Accounts → Select the service account
6. Create a key (JSON)
7. Share your Google Drive folder with this service account email
8. Set the JSON key as environment variable

### Option 3: OAuth2 Service Account (Best for Production)

Let the service account impersonate a user with access to the Drive files.

## What the Current Code Expects

Line 12-14 in google-drive.ts:
```typescript
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.file']
});
```

This **automatically** tries to load credentials from:
1. `$GOOGLE_APPLICATION_CREDENTIALS` environment variable (if set)
2. Cloud Run metadata server (if running on Cloud Run)
3. Default Application Credentials from user's SDK config
4. Fails if none found

## Testing It

Add logging to see exactly what's failing:

```bash
# Check Cloud Run logs
gcloud run logs tail songbook-app --region=us-west1 --limit=100

# Look for:
# ✅ "[Google Drive] ✅ Client initialized" → Success
# ❌ "[Google Drive] Failed to initialize:" → Credentials missing or invalid
```

## How to Fix

**You need to provide Google Drive credentials to Cloud Run.**

The simplest path:

1. **Create a service account** in Google Cloud
2. **Grant it Drive access** (share your folder with it)
3. **Download the JSON key**
4. **Upload key to project** (NOT to git - use Secret Manager)
5. **Set `GOOGLE_APPLICATION_CREDENTIALS`** on Cloud Run pointing to the key file
6. **Restart Cloud Run**

## Why It Works on Replit But Not Cloud Run

- **Replit**: Uses Replit Connectors which manage OAuth automatically
- **Cloud Run**: Needs explicit service account credentials OR OAuth setup

These are completely different auth systems, which is why code written for one often fails on the other.

## Next Steps

1. Check Cloud Run logs for the exact error
2. Create service account with Drive permissions
3. Upload credentials to deployment
4. Set environment variable
5. Test image loading

Without service account credentials, ANY code trying to access Google Drive will fail, regardless of how well-written it is.
