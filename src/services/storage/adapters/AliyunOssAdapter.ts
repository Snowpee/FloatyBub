// 阿里云OSS适配器实现
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { StorageAdapter, StorageConfig, UploadOptions, UploadResult } from '../types';

const normalizeOssRegion = (region: string) => {
  const trimmed = region.trim()
  if (!trimmed) return trimmed
  return trimmed.startsWith('oss-') ? trimmed : `oss-${trimmed}`
}

export class AliyunOssAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private region: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.region = normalizeOssRegion(config.region);
    // 阿里云OSS使用S3兼容API
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint || `https://${this.region}.aliyuncs.com`,
      forcePathStyle: false,
    });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { key, file, contentType, isPublic, metadata } = options;
    
    // 在浏览器环境中，需要将File对象转换为ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: new Uint8Array(fileBuffer),
      ContentType: contentType || file.type,
      ACL: isPublic ? 'public-read' : 'private',
      Metadata: metadata,
    });

    const result = await this.client.send(command);
    
    return {
      key,
      url: `https://${this.bucket}.${this.region}.aliyuncs.com/${key}`,
      etag: result.ETag || '',
      size: file.size,
    };
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    await this.client.send(command);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async listObjects(prefix?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });
    
    const result = await this.client.send(command);
    return result.Contents?.map(obj => obj.Key || '') || [];
  }
}
