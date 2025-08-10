// 存储服务类型定义

export interface StorageConfig {
  provider: 'aws' | 'tencent' | 'aliyun';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
}

export interface UploadOptions {
  key: string;
  file: File;
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  etag: string;
  size: number;
}

export interface StorageAdapter {
  upload(options: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  listObjects(prefix?: string): Promise<string[]>;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  storageProvider: string;
  accessUrl: string;
  isPublic: boolean;
  metadata?: Record<string, any>;
}