import crypto from 'crypto';

export interface StorageResult {
  storagePath: string;
  fileHash: string;
  fileSizeBytes: number;
}

export interface IStorageProvider {
  uploadFile(orgId: string, docId: string, versionNumber: number, fileName: string, buffer: Buffer): Promise<StorageResult>;
  downloadFile(storagePath: string): Promise<Buffer | null>;
  deleteFile(storagePath: string): Promise<void>;
}

export class LocalStorageProvider implements IStorageProvider {
  private storage: Map<string, Buffer> = new Map();

  async uploadFile(
    orgId: string,
    docId: string,
    versionNumber: number,
    fileName: string,
    buffer: Buffer
  ): Promise<StorageResult> {
    // Generate safe storage path without path traversal risks
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const storagePath = `org_${orgId}/docs/${docId}/v${versionNumber}_${safeName}`;

    this.storage.set(storagePath, buffer);

    return {
      storagePath,
      fileHash: hash,
      fileSizeBytes: buffer.length,
    };
  }

  async downloadFile(storagePath: string): Promise<Buffer | null> {
    return this.storage.get(storagePath) || null;
  }

  async deleteFile(storagePath: string): Promise<void> {
    this.storage.delete(storagePath);
  }
}

export const storageProvider: IStorageProvider = new LocalStorageProvider();
