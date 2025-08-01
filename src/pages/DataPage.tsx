import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import {
  Download,
  Upload,
  Trash2,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';

interface DataPageProps {
  onCloseModal?: () => void;
}

const DataPage: React.FC<DataPageProps> = ({ onCloseModal }) => {
  const {
    llmConfigs,
    aiRoles,
    chatSessions,
    exportData,
    importData,
    clearAllData
  } = useAppStore();
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const clearConfirmModalRef = useRef<HTMLDialogElement>(null);

  // 处理模态框显示
  useEffect(() => {
    if (showClearConfirm) {
      clearConfirmModalRef.current?.showModal();
    }
  }, [showClearConfirm]);

  // 监听模态框关闭事件
  useEffect(() => {
    const modal = clearConfirmModalRef.current;
    if (modal) {
      const handleClose = () => {
        setShowClearConfirm(false);
      };
      modal.addEventListener('close', handleClose);
      return () => modal.removeEventListener('close', handleClose);
    }
  }, []);

  // 计算数据统计
  const stats = {
    configs: llmConfigs.length,
    roles: aiRoles.length,
    sessions: chatSessions.length,
    messages: chatSessions.reduce((total, session) => total + session.messages.length, 0)
  };

  // 导出数据
  const handleExport = () => {
    try {
      const data = exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('数据导出成功！');
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setImportFile(file);
      } else {
        toast.error('请选择JSON格式的文件');
      }
    }
  };

  // 导入数据
  const handleImport = async () => {
    if (!importFile) {
      toast.error('请先选择要导入的文件');
      return;
    }

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const success = importData(text);
      
      if (success) {
        toast.success('数据导入成功！');
        setImportFile(null);
        // 重置文件输入
        const fileInput = document.getElementById('import-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        toast.error('导入失败：数据格式不正确');
      }
    } catch (error) {
      toast.error('导入失败：' + (error instanceof Error ? error.message : '文件读取错误'));
    } finally {
      setIsImporting(false);
    }
  };

  // 清空所有数据
  const handleClearAll = () => {
    clearAllData();
    clearConfirmModalRef.current?.close();
    toast.success('所有数据已清空');
  };

  // 取消清空操作
  const handleCancelClear = () => {
    clearConfirmModalRef.current?.close();
  };

  // 计算存储大小（估算）
  const getStorageSize = () => {
    try {
      const data = exportData();
      const sizeInBytes = new Blob([data]).size;
      if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
      } else if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
      } else {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    } catch {
      return '未知';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 md:pt-0">
      {/* 页面标题 */}
      <div className="flex items-center space-x-3">
        <div>
          <p className="text-base-content/70">
            管理您的配置、角色和聊天历史数据
          </p>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
        <div className="stat">
          <div className="stat-figure text-primary">
            <Database className="h-8 w-8" />
          </div>
          <div className="stat-title">LLM配置</div>
          <div className="stat-value text-primary">{stats.configs}</div>
        </div>
        
        <div className="stat">
          <div className="stat-figure text-secondary">
            <FileText className="h-8 w-8" />
          </div>
          <div className="stat-title">AI角色</div>
          <div className="stat-value text-secondary">{stats.roles}</div>
        </div>
        
        <div className="stat">
          <div className="stat-figure text-accent">
            <FileText className="h-8 w-8" />
          </div>
          <div className="stat-title">聊天会话</div>
          <div className="stat-value text-accent">{stats.sessions}</div>
        </div>
        
        <div className="stat">
          <div className="stat-figure text-info">
            <FileText className="h-8 w-8" />
          </div>
          <div className="stat-title">消息总数</div>
          <div className="stat-value text-info">{stats.messages}</div>
        </div>
      </div>

      {/* 存储信息 */}
      <div className="card bg-base-100 dark:bg-gray-800 p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2" />
          存储信息
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">存储位置</p>
            <p className="text-gray-900 dark:text-white">浏览器本地存储 (localStorage)</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">数据大小</p>
            <p className="text-gray-900 dark:text-white">{getStorageSize()}</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 数据自动保存在浏览器本地，清除浏览器数据会导致配置丢失。建议定期导出备份。
          </p>
        </div>
      </div>

      {/* 数据操作 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 导出数据 */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-base-content flex items-center">
              <Download className="h-5 w-5 mr-2" />
              导出数据
            </h2>
            <p className="text-base-content/70 mb-4">
              将所有配置、角色和聊天历史导出为JSON文件，用于备份或迁移。
            </p>
            <button
              onClick={handleExport}
              className="btn btn-primary w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </button>
          </div>
        </div>

        {/* 导入数据 */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-base-content flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              导入数据
            </h2>
            <p className="text-base-content/70 mb-4">
              从之前导出的JSON文件恢复数据。注意：这将覆盖当前所有数据。
            </p>
            
            <div className="space-y-3">
              <div>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="file-input file-input-bordered w-full"
                />
              </div>
              
              {importFile && (
                <div className="alert alert-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>已选择文件: {importFile.name}</span>
                </div>
              )}
              
              <button
                onClick={handleImport}
                disabled={!importFile || isImporting}
                className="btn btn-success w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? '导入中...' : '导入数据'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 危险操作 */}
      <div className="card bg-base-100 shadow-sm border border-error">
        <div className="card-body">
          <h2 className="card-title text-error mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            危险操作
          </h2>
          <div className="alert alert-error alert-soft mb-4">
            <AlertTriangle className="h-4 w-4" />
            <span>以下操作不可逆，请谨慎使用。建议在执行前先导出数据备份。</span>
          </div>
          
          <button
            onClick={() => setShowClearConfirm(true)}
            className="btn btn-error flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清空所有数据
          </button>
        </div>
      </div>

      {/* 清空确认模态框 */}
      <dialog ref={clearConfirmModalRef} className="modal">
        <div className="modal-box">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-error mr-3" />
            <h3 className="text-lg font-semibold text-base-content">
              确认清空所有数据
            </h3>
          </div>
          <p className="text-base-content/70 mb-6">
            此操作将删除所有LLM配置、AI角色和聊天历史，且无法恢复。您确定要继续吗？
          </p>
          <div className="modal-action">
            <button
              onClick={handleCancelClear}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              onClick={handleClearAll}
              className="btn btn-error"
            >
              确认清空
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default DataPage;