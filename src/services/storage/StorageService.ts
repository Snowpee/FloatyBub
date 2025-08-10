// 统一存储服务管理器
import { v4 as uuidv4 } from 'uuid';
import { lookup } from 'mime-types';
import type { StorageAdapter, StorageConfig, UploadOptions, UploadResult, FileMetadata} from './types';
import { AwsS3Adapter } from './adapters/AwsS3Adapter';
import { TencentCosAdapter } from './adapters/TencentCosAdapter';
import { AliyunOssAdapter } from './adapters/AliyunOssAdapter';

export class StorageService {
  private adapter: StorageAdapter;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.adapter = this.createAdapter(config);
  }

  private createAdapter(config: StorageConfig): StorageAdapter {
    switch (config.provider) {
      case 'aws':
        return new AwsS3Adapter(config);
      case 'tencent':
        return new TencentCosAdapter(config);
      case 'aliyun':
        return new AliyunOssAdapter(config);
      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(
    file: File,
    options: {
      folder?: string;
      filename?: string;
      isPublic?: boolean;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<FileMetadata> {
    const { folder = 'uploads', filename, isPublic = true, metadata } = options;
    
    // 生成唯一文件名
    const fileId = uuidv4();
    const extension = file.name.split('.').pop() || '';
    const finalFilename = filename || `${fileId}.${extension}`;
    const storageKey = folder ? `${folder}/${finalFilename}` : finalFilename;
    
    // 获取MIME类型
    const mimeType = file.type || lookup(file.name) || 'application/octet-stream';
    
    const uploadOptions: UploadOptions = {
      key: storageKey,
      file,
      contentType: mimeType,
      isPublic,
      metadata,
    };

    const result = await this.adapter.upload(uploadOptions);

    return {
      id: fileId,
      originalName: file.name,
      storageKey: result.key,
      fileSize: result.size,
      mimeType,
      storageProvider: this.config.provider,
      accessUrl: result.url,
      isPublic,
      metadata,
    };
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<void> {
    await this.adapter.delete(key);
  }

  /**
   * 获取签名URL（用于私有文件访问）
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return await this.adapter.getSignedUrl(key, expiresIn);
  }

  /**
   * 列出文件
   */
  async listFiles(prefix?: string): Promise<string[]> {
    return await this.adapter.listObjects(prefix);
  }

  /**
   * 上传头像（专用方法）
   */
  async uploadAvatar(file: File, userId?: string): Promise<FileMetadata> {
    const folder = 'avatars';
    const filename = userId ? `${userId}_${Date.now()}` : undefined;
    
    return await this.uploadFile(file, {
      folder,
      filename,
      isPublic: true,
      metadata: {
        type: 'avatar',
        userId: userId || 'anonymous',
      },
    });
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.adapter.delete(key)));
  }

}

// 创建存储服务实例的工厂函数
export function createStorageService(): StorageService | null {
  try {
    // 在浏览器环境中，环境变量通过import.meta.env访问
    const config: StorageConfig = {
      provider: (import.meta.env.VITE_STORAGE_PROVIDER as any) || 'aws',
      accessKeyId: import.meta.env.VITE_STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: import.meta.env.VITE_STORAGE_SECRET_ACCESS_KEY || '',
      region: import.meta.env.VITE_STORAGE_REGION || '',
      bucket: import.meta.env.VITE_STORAGE_BUCKET || '',
      endpoint: import.meta.env.VITE_STORAGE_ENDPOINT,
    };

    // 验证必需的配置
    if (!config.accessKeyId || !config.secretAccessKey || !config.region || !config.bucket) {
      console.warn('Storage service configuration is incomplete. Please set VITE_STORAGE_* environment variables.');
      return null;
    }

    return new StorageService(config);
  } catch (error) {
    console.error('Failed to create storage service:', error);
    return null;
  }
}