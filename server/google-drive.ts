import { google } from 'googleapis';
import { Readable } from 'stream';

let driveClient: any = null;

/**
 * Get Google Drive client using Service Account credentials
 * Works on Cloud Run (no Replit dependencies)
 */
async function getDriveClient() {
  if (driveClient) return driveClient;

  // Check for service account credentials (Cloud Run)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });
      driveClient = google.drive({ version: 'v3', auth });
      console.log('[Google Drive] ✅ Service account client initialized');
      return driveClient;
    } catch (err) {
      console.error('[Google Drive] Failed to parse service account credentials:', err);
      throw new Error('Invalid service account credentials');
    }
  }
  
  // Fallback for local development (optional)
  if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    driveClient = google.drive({ version: 'v3', auth });
    console.log('[Google Drive] ✅ JWT client initialized');
    return driveClient;
  }
  
  console.error('[Google Drive] ❌ No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS_JSON');
  throw new Error('Google Drive not configured: Missing service account credentials');
}

// For backward compatibility - replaces getUncachableGoogleDriveClient
export async function getUncachableGoogleDriveClient() {
  return getDriveClient();
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
}

/**
 * Get the root folder ID - use the user-provided folder
 */
export async function getOrCreateRootFolder(): Promise<string> {
  const userProvidedFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1qVMCSSVYP0gr-mZPgDS1yEYGhSHWIl97';
  
  console.log(`[Google Drive] Using root folder: ${userProvidedFolderId}`);
  console.log(`[Google Drive] Access at: https://drive.google.com/drive/folders/${userProvidedFolderId}`);
  
  return userProvidedFolderId;
}

/**
 * List all subfolders in the root folder
 */
export async function listSubfolders(parentFolderId: string): Promise<DriveFolder[]> {
  try {
    console.log(`[Google Drive] Listing subfolders in parent: ${parentFolderId}`);
    const drive = await getDriveClient();

    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
    }));
    
    console.log(`[Google Drive] Found ${folders.length} subfolders`);
    return folders;
  } catch (error) {
    console.error('[Google Drive] Error listing subfolders:', error);
    return [];
  }
}

/**
 * List all files in a specific folder
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  try {
    const drive = await getDriveClient();
    
    console.log(`[Google Drive] Listing files in folder: ${folderId}`);

    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    
    console.log(`[Google Drive] Found ${response.data.files?.length || 0} files`);

    return (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size ?? undefined,
      thumbnailLink: file.thumbnailLink ?? undefined,
      webViewLink: file.webViewLink ?? undefined,
      webContentLink: file.webContentLink ?? undefined,
    }));
  } catch (error) {
    console.error(`[Google Drive] Error listing files:`, error);
    return [];
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = await getDriveClient();

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
    size: response.data.size ?? undefined,
    thumbnailLink: response.data.thumbnailLink ?? undefined,
    webViewLink: response.data.webViewLink ?? undefined,
    webContentLink: response.data.webContentLink ?? undefined,
  };
}

/**
 * Upload a file to a specific folder
 */
export async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<DriveFile> {
  const drive = await getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
    size: response.data.size ?? undefined,
    thumbnailLink: response.data.thumbnailLink ?? undefined,
    webViewLink: response.data.webViewLink ?? undefined,
    webContentLink: response.data.webContentLink ?? undefined,
  };
}

/**
 * Create a new subfolder in the root folder
 */
export async function createSubfolder(parentFolderId: string, folderName: string): Promise<DriveFolder> {
  const drive = await getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
  };
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.delete({ 
    fileId,
    supportsAllDrives: true,
  });
}
