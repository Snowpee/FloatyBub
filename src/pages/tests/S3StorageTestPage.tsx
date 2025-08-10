import React, { useState, useRef } from 'react';
import { Upload, Download, Trash2, List, Image, AlertCircle, CheckCircle } from 'lucide-react';
import { createStorageService } from '../../services/storage/StorageService';
import type { FileMetadata } from '../../services/storage/types';

interface UploadedFile {
  metadata: FileMetadata;
  previewUrl?: string;
}

export default function S3StorageTestPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storageService] = useState(() => createStorageService());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || !storageService) {
      showMessage('error', '存储服务未配置或文件选择失败');
      return;
    }

    setLoading(true);
    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file) => {
        const metadata = await storageService.uploadFile(file, {
          folder: 'test-uploads',
          isPublic: true,
        });

        const uploadedFile: UploadedFile = {
          metadata,
        };

        // 如果是图片，生成预览URL
        if (file.type.startsWith('image/')) {
          uploadedFile.previewUrl = metadata.accessUrl;
        }

        return uploadedFile;
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setFiles(prev => [...prev, ...uploadedFiles]);
      showMessage('success', `成功上传 ${uploadedFiles.length} 个文件`);
    } catch (error) {
      console.error('Upload failed:', error);
      showMessage('error', `上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (file: UploadedFile) => {
    if (!storageService) {
      showMessage('error', '存储服务未配置');
      return;
    }

    setLoading(true);
    try {
      await storageService.deleteFile(file.metadata.storageKey);
      setFiles(prev => prev.filter(f => f.metadata.id !== file.metadata.id));
      showMessage('success', '文件删除成功');
    } catch (error) {
      console.error('Delete failed:', error);
      showMessage('error', `删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetSignedUrl = async (file: UploadedFile) => {
    if (!storageService) {
      showMessage('error', '存储服务未配置');
      return;
    }

    try {
      const signedUrl = await storageService.getSignedUrl(file.metadata.storageKey, 3600);
      navigator.clipboard.writeText(signedUrl);
      showMessage('success', '签名URL已复制到剪贴板');
    } catch (error) {
      console.error('Get signed URL failed:', error);
      showMessage('error', `获取签名URL失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleListFiles = async () => {
    if (!storageService) {
      showMessage('error', '存储服务未配置');
      return;
    }

    setLoading(true);
    try {
      const fileKeys = await storageService.listFiles('test-uploads/');
      showMessage('success', `找到 ${fileKeys.length} 个文件`);
      console.log('Files in bucket:', fileKeys);
    } catch (error) {
      console.error('List files failed:', error);
      showMessage('error', `列出文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!storageService) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">存储服务未配置</h3>
                <p className="text-red-600 mt-1">
                  请配置环境变量：STORAGE_PROVIDER, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_REGION, STORAGE_BUCKET
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">S3存储服务测试</h1>

          {/* 消息提示 */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-4 mb-6">
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 mr-2" />
              上传文件
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,application/pdf,text/*"
              />
            </label>

            <button
              onClick={handleListFiles}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <List className="w-4 h-4 mr-2" />
              列出文件
            </button>
          </div>

          {/* 加载状态 */}
          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">处理中...</p>
            </div>
          )}

          {/* 文件列表 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">已上传文件 ({files.length})</h2>
            
            {files.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无文件，请上传文件进行测试</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {files.map((file) => (
                  <div key={file.metadata.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {file.previewUrl && (
                            <img
                              src={file.previewUrl}
                              alt={file.metadata.originalName}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">{file.metadata.originalName}</h3>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.metadata.fileSize)} • {file.metadata.mimeType}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <p><strong>存储键:</strong> {file.metadata.storageKey}</p>
                          <p><strong>提供商:</strong> {file.metadata.storageProvider}</p>
                          <p><strong>访问URL:</strong> 
                            <a 
                              href={file.metadata.accessUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline ml-1"
                            >
                              {file.metadata.accessUrl}
                            </a>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleGetSignedUrl(file)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="获取签名URL"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(file)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="删除文件"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}