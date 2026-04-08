import { google } from 'googleapis';
import { Readable } from 'stream';

let driveClient: any = null;

async function getDriveClient() {
  if (driveClient) return driveClient;

  try {
    let credentials;
    
    // Try to get credentials from environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Check if it's a string that looks like JSON
      const credsValue = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      if (credsValue.startsWith('{')) {
        // It's the actual JSON content
        credentials = JSON.parse(credsValue);
        console.log('[Google Drive] ✅ Credentials loaded from env var');
      } else {
        // It might be a reference, but for now treat as is
        console.log('[Google Drive] ⚠ Credentials value doesn\'t look like JSON');
        throw new Error('Invalid credentials format');
      }
    }
    else {
      console.error('[Google Drive] ❌ No credentials found');
      throw new Error('Google Drive not configured: Missing service account credentials');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    driveClient = google.drive({ version: 'v3', auth });
    console.log('[Google Drive] ✅ Service account client initialized');
    return driveClient;
  } catch (err) {
    console.error('[Google Drive] Failed to initialize:', err);
    throw new Error('Google Drive not configured: Missing service account credentials');
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
    return (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
    }));
  } catch (error) {
    console.error('[Google Drive] Error listing subfolders:', error);
    return [];
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
    console.error('[Google Drive] Error listing files:', error);
    return [];
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
