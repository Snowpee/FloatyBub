// 知识库批量导入组件

import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import type { KnowledgeBase, ImportKnowledgeEntry } from '../../types/knowledge';

interface KnowledgeBulkImportProps {
  knowledgeBase: KnowledgeBase;
  onCancel: () => void;
  onSuccess?: () => void;
}

export const KnowledgeBulkImport: React.FC<KnowledgeBulkImportProps> = ({
  knowledgeBase,
  onCancel,
  onSuccess
}) => {
  const { loading, bulkImportKnowledgeEntries } = useKnowledgeStore();
  const modalRef = useRef<HTMLDialogElement>(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [importData, setImportData] = useState<ImportKnowledgeEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'validating' | 'importing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.showModal();
    }
  }, []);

  const handleClose = () => {
    if (modalRef.current) {
      modalRef.current.close();
    }
    onCancel();
  };

  // 处理文件拖拽
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // 处理文件放置
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // 处理文件内容
  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.json') && !file.name.endsWith('.csv')) {
      setErrors(['仅支持 JSON 和 CSV 格式的文件']);
      return;
    }

    setImportStatus('validating');
    setErrors([]);

    try {
      const text = await file.text();
      let data: ImportKnowledgeEntry[] = [];

      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      }

      const validationErrors = validateImportData(data);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setImportStatus('error');
        return;
      }

      setImportData(data);
      setImportStatus('idle');
    } catch (error) {
      setErrors(['文件格式错误，请检查文件内容']);
      setImportStatus('error');
    }
  };

  // 解析 CSV 文件
  const parseCSV = (text: string): ImportKnowledgeEntry[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV 文件格式错误');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name') || h.includes('名称'));
    const keywordsIndex = headers.findIndex(h => h.toLowerCase().includes('keyword') || h.includes('关键词'));
    const explanationIndex = headers.findIndex(h => h.toLowerCase().includes('explanation') || h.includes('解释') || h.includes('说明'));

    if (nameIndex === -1 || keywordsIndex === -1 || explanationIndex === -1) {
      throw new Error('CSV 文件必须包含名称、关键词和解释列');
    }

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const keywords = values[keywordsIndex] ? values[keywordsIndex].split(';').map(k => k.trim()).filter(k => k) : [];
      
      return {
        name: values[nameIndex] || '',
        keywords,
        explanation: values[explanationIndex] || ''
      };
    });
  };

  // 验证导入数据
  const validateImportData = (data: any[]): string[] => {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('数据格式错误，应为数组格式');
      return errors;
    }

    if (data.length === 0) {
      errors.push('文件中没有有效数据');
      return errors;
    }

    if (data.length > 1000) {
      errors.push('单次导入不能超过1000条记录');
    }

    data.forEach((item, index) => {
      const lineNum = index + 1;
      
      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        errors.push(`第${lineNum}行：名称不能为空`);
      } else if (item.name.trim().length > 100) {
        errors.push(`第${lineNum}行：名称长度不能超过100个字符`);
      }

      if (!item.keywords || !Array.isArray(item.keywords) || item.keywords.length === 0) {
        errors.push(`第${lineNum}行：至少需要一个关键词`);
      } else if (item.keywords.some((k: any) => typeof k !== 'string' || k.trim().length > 50)) {
        errors.push(`第${lineNum}行：关键词格式错误或长度超过50个字符`);
      }

      if (!item.explanation || typeof item.explanation !== 'string' || !item.explanation.trim()) {
        errors.push(`第${lineNum}行：解释内容不能为空`);
      } else if (item.explanation.trim().length > 2000) {
        errors.push(`第${lineNum}行：解释内容长度不能超过2000个字符`);
      }
    });

    return errors;
  };

  // 执行导入
  const handleImport = async () => {
    if (importData.length === 0) return;

    setImportStatus('importing');
    try {
      const result = await bulkImportKnowledgeEntries(knowledgeBase.id, importData);
      setImportResult(result);
      setImportStatus('success');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setErrors(['导入失败，请稍后重试']);
      setImportStatus('error');
    }
  };

  // 下载模板
  const downloadTemplate = () => {
    const template = [
      { name: '示例条目1', keywords: ['关键词1', '关键词2'], explanation: '这是一个示例解释内容' },
      { name: '示例条目2', keywords: ['关键词3'], explanation: '这是另一个示例解释内容' }
    ];
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge_entries_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 重置状态
  const resetImport = () => {
    setImportData([]);
    setErrors([]);
    setImportStatus('idle');
    setImportResult({ success: 0, failed: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <dialog ref={modalRef} className="modal">
      <div className="modal-box w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-circle"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-semibold text-base-content">
            批量导入知识条目 - {knowledgeBase.name}
          </h3>
        </div>

        <div>
          {/* 导入成功状态 */}
          {importStatus === 'success' && (
            <div className="alert alert-success mb-6">
              <CheckCircle className="w-5 h-5" />
              <div>
                <h3 className="font-medium">导入完成</h3>
                <div className="text-sm opacity-70">
                  成功导入 {importResult.success} 条记录
                  {importResult.failed > 0 && `，失败 ${importResult.failed} 条`}
                </div>
              </div>
              <button
                onClick={resetImport}
                className="btn btn-success btn-sm"
              >
                继续导入
              </button>
            </div>
          )}

          {/* 错误信息 */}
          {errors.length > 0 && (
            <div className="alert alert-error mb-6">
              <AlertCircle className="w-5 h-5" />
              <div>
                <h3 className="font-medium">导入错误</h3>
                <ul className="text-sm space-y-1 mt-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 文件上传区域 */}
          {importStatus !== 'success' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-base-content">选择文件</h3>
                <button
                  onClick={downloadTemplate}
                  className="btn btn-outline btn-sm gap-2"
                >
                  <Download className="w-4 h-4" />
                  下载模板
                </button>
              </div>
              
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 hover:border-base-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={importStatus === 'validating' || importStatus === 'importing'}
                />
                
                <div className="flex flex-col items-center gap-4">
                  <Upload className="w-12 h-12 text-base-content/40" />
                  <div>
                    <p className="text-lg font-medium text-base-content">
                      拖拽文件到此处或点击选择
                    </p>
                    <p className="text-sm text-base-content/60 mt-1">
                      支持 JSON 和 CSV 格式，最大1000条记录
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 数据预览 */}
          {importData.length > 0 && importStatus !== 'success' && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-base-content mb-4">
                数据预览 ({importData.length} 条记录)
              </h3>
              <div className="border border-base-300 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-base-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                          名称
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                          关键词
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider">
                          解释内容
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-base-100 divide-y divide-base-300">
                      {importData.slice(0, 10).map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-base-content">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-base-content/70">
                            {item.keywords.join(', ')}
                          </td>
                          <td className="px-4 py-3 text-sm text-base-content/70 max-w-xs truncate">
                            {item.explanation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importData.length > 10 && (
                  <div className="px-4 py-3 bg-base-200 text-sm text-base-content/70 text-center">
                    还有 {importData.length - 10} 条记录未显示
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 格式说明 */}
          {importStatus !== 'success' && (
            <div className="mb-6 p-4 bg-base-200 border border-base-300 rounded-lg">
              <h4 className="font-medium text-base-content mb-2">文件格式说明</h4>
              <div className="text-sm text-base-content/70 space-y-2">
                <p><strong>JSON 格式：</strong>数组格式，每个对象包含 name、keywords、explanation 字段</p>
                <p><strong>CSV 格式：</strong>第一行为标题行，包含名称、关键词、解释列，关键词用分号分隔</p>
                <p><strong>字段要求：</strong></p>
                <ul className="ml-4 space-y-1">
                  <li>• 名称：2-100个字符</li>
                  <li>• 关键词：至少1个，每个不超过50个字符</li>
                  <li>• 解释：10-2000个字符</li>
                </ul>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="modal-action">
            <form method="dialog">
              <button
                onClick={handleClose}
                className="btn btn-ghost"
                disabled={importStatus === 'importing'}
              >
                取消
              </button>
            </form>
            
            {importData.length > 0 && importStatus !== 'success' && (
              <button
                onClick={resetImport}
                className="btn btn-outline"
                disabled={importStatus === 'importing'}
              >
                重新选择
              </button>
            )}
            
            {importData.length > 0 && importStatus !== 'success' && errors.length === 0 && (
              <button
                onClick={handleImport}
                disabled={importStatus === 'importing' || loading}
                className="btn btn-primary"
              >
                {(importStatus === 'importing' || loading) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {importStatus === 'importing' ? '导入中...' : `导入 ${importData.length} 条记录`}
              </button>
            )}
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
};