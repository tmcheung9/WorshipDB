import { google } from 'googleapis';
import { Readable } from 'stream';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  console.log(`[Google Drive Auth] Fetching connection from hostname: ${hostname}`);
  
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => {
    const itemCount = data.items?.length || 0;
    console.log(`[Google Drive Auth] Found ${itemCount} connection(s)`);
    return data.items?.[0];
  });

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('[Google Drive Auth] No connection or access token found');
    throw new Error('Google Drive not connected');
  }
  
  console.log('[Google Drive Auth] Access token obtained successfully');
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
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
 * The user should add files/folders directly to this folder through Google Drive
 */
export async function getOrCreateRootFolder(): Promise<string> {
  // Use the hardcoded folder ID from the user
  const userProvidedFolderId = '1qVMCSSVYP0gr-mZPgDS1yEYGhSHWIl97';
  
  console.log(`[Google Drive] Using user-provided root folder: ${userProvidedFolderId}`);
  console.log(`[Google Drive] Access it at: https://drive.google.com/drive/folders/${userProvidedFolderId}`);
  console.log(`[Google Drive] Note: Create subfolders in this folder through Google Drive to add categories`);
  
  return userProvidedFolderId;
}

/**
 * List all subfolders in the root folder
 * These subfolders represent categories (e.g., 敬拜讚美, 福音詩歌, etc.)
 * 
 * Note: With drive.file scope, we can only see folders/files created by this app
 * OR folders that have been explicitly shared with the app
 */
export async function listSubfolders(parentFolderId: string): Promise<DriveFolder[]> {
  try {
    console.log(`[Google Drive] Listing subfolders in parent: ${parentFolderId}`);
    const drive = await getUncachableGoogleDriveClient();

    // Try multiple query approaches to find accessible folders
    
    // Approach 1: Standard query for subfolders
    const query1 = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    console.log(`[Google Drive] Query 1 (standard): ${query1}`);
    
    let response = await drive.files.list({
      q: query1,
      fields: 'files(id, name)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    console.log(`[Google Drive] Response 1:`, JSON.stringify(response.data, null, 2));
    
    // If no results, try searching for all accessible folders created recently
    if (!response.data.files || response.data.files.length === 0) {
      console.log(`[Google Drive] No subfolders found, trying alternate approach`);
      
      // Approach 2: List all folders the app can access
      const query2 = `mimeType='application/vnd.google-apps.folder' and trashed=false`;
      console.log(`[Google Drive] Query 2 (all accessible): ${query2}`);
      
      response = await drive.files.list({
        q: query2,
        fields: 'files(id, name, parents)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      
      console.log(`[Google Drive] Response 2 (all folders):`, JSON.stringify(response.data, null, 2));
      
      // Filter to only folders that have the parent ID
      const allFolders = response.data.files || [];
      response.data.files = allFolders.filter(file => 
        file.parents && file.parents.includes(parentFolderId)
      );
      
      console.log(`[Google Drive] Filtered to parent folders:`, JSON.stringify(response.data.files, null, 2));
    }
    
    const folders = (response.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
    }));
    
    console.log(`[Google Drive] Returning ${folders.length} folders`);
    return folders;
  } catch (error) {
    console.error('[Google Drive] Error listing subfolders:', error);
    return []; // Return empty array instead of throwing to prevent crashes
  }
}

/**
 * List all files in a specific folder (category)
 * This gets all song files within a category subfolder
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    
    console.log(`[Google Drive] Listing files in folder: ${folderId}`);

    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    
    console.log(`[Google Drive] Found ${response.data.files?.length || 0} files in folder ${folderId}`);
    if (response.data.files && response.data.files.length > 0) {
      console.log(`[Google Drive] Files:`, JSON.stringify(response.data.files.map(f => ({ id: f.id, name: f.name })), null, 2));
    }

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
    console.error(`[Google Drive] Error listing files in folder ${folderId}:`, error);
    return [];
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = await getUncachableGoogleDriveClient();

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink',
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
  const drive = await getUncachableGoogleDriveClient();

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
 * Create a new subfolder (category) in the root folder
 */
export async function createSubfolder(parentFolderId: string, folderName: string): Promise<DriveFolder> {
  const drive = await getUncachableGoogleDriveClient();

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
  const drive = await getUncachableGoogleDriveClient();
  await drive.files.delete({ 
    fileId,
    supportsAllDrives: true,
  });
}
