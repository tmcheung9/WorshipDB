import { google } from 'googleapis';
import { Readable } from 'stream';

let driveClient: any = null;

async function getDriveClient() {
  if (driveClient) return driveClient;

  try {
    // Use Google's default credential lookup with full Drive scope
    // This automatically works on Cloud Run with the service account
    // Using full drive scope to access shared folders and all files
    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    const authClient = await auth.getClient();
    driveClient = google.drive({ version: 'v3', auth: authClient });

    console.log('[Google Drive] ✅ Client initialized with service account');
    console.log('[Google Drive] Scopes: drive, drive.file');

    return driveClient;
  } catch (err) {
    console.error('[Google Drive] Failed to initialize:', err);
    console.error('[Google Drive] Error details:', err instanceof Error ? err.stack : err);
    throw new Error('Google Drive not configured');
  }
}

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

export async function getOrCreateRootFolder(): Promise<string> {
  const userProvidedFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1qVMCSSVYP0gr-mZPgDS1yEYGhSHWIl97';
  console.log(`[Google Drive] Using root folder: ${userProvidedFolderId}`);
  return userProvidedFolderId;
}

export async function listSubfolders(parentFolderId: string): Promise<DriveFolder[]> {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log(`[Google Drive] Listed subfolders - found ${response.data.files?.length || 0} folders`);
    return (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
    }));
  } catch (error) {
    console.error('[Google Drive] Error listing subfolders:', error instanceof Error ? error.message : error);
    console.error('[Google Drive] Full error:', error);
    throw error;
  }
}

export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log(`[Google Drive] Listed files in folder - found ${response.data.files?.length || 0} files`);
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
    console.error('[Google Drive] Error listing files:', error instanceof Error ? error.message : error);
    console.error('[Google Drive] Full error:', error);
    throw error;
  }
}

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

export async function deleteFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.delete({ 
    fileId,
    supportsAllDrives: true,
  });
}
