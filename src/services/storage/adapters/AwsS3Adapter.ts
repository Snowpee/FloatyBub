// AWS S3适配器实现
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { StorageAdapter, StorageConfig, UploadOptions, UploadResult } from '@/services/storage/types';

export class AwsS3Adapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && { endpoint: config.endpoint }),
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
      url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
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