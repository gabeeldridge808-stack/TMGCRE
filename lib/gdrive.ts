import { google, drive_v3 } from "googleapis";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string; // ISO 8601
  /** Folder path relative to the ingested root, e.g. "Financials/2024" */
  folderPath: string;
}

function getDriveClient(): drive_v3.Drive {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY is not set. Create a service account in Google " +
        "Cloud Console, share the target Drive folder with its client_email, and " +
        "paste the full key JSON into .env.local."
    );
  }

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(rawKey);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Recursively lists every non-folder file under a Drive folder. Deal rooms
 * are typically organized into subfolders (Financials/, Legal/, ...), so a
 * flat top-level listing would silently miss most of the documents.
 */
export async function listFilesInFolder(
  folderId: string,
  folderPath = ""
): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const files: DriveFile[] = [];

  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
      pageSize: 200,
      pageToken,
    });

    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name || !f.mimeType || !f.modifiedTime) continue;

      if (f.mimeType === FOLDER_MIME) {
        const subPath = folderPath ? `${folderPath}/${f.name}` : f.name;
        files.push(...(await listFilesInFolder(f.id, subPath)));
      } else {
        files.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
          folderPath,
        });
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * Downloads a file's raw bytes. For native Google Docs (no downloadable
 * bytes), exports to plain text instead — callers should treat the
 * returned mimeType, not the input mimeType, as authoritative for
 * extraction (a Google Doc comes back as "text/plain").
 */
export async function downloadFile(
  file: Pick<DriveFile, "id" | "mimeType">
): Promise<{ buffer: Buffer; mimeType: string }> {
  const drive = getDriveClient();

  if (file.mimeType === GOOGLE_DOC_MIME) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: "text/plain" },
      { responseType: "arraybuffer" }
    );
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: "text/plain" };
  }

  const res = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: file.mimeType };
}
