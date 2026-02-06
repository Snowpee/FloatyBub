import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Save,
  FileText,
  Trash2,
  Plus,
  FolderOpen
} from 'lucide-react';
import { InputProvider } from '@/components/InputProvider';
import { AgentSkill, AgentSkillFile } from '@/store';
import { toast } from '@/hooks/useToast';
import BottomSheetModal from '@/components/BottomSheetModal';
import { cn } from '@/lib/utils';

export interface SkillFormData {
  name: string;
  description: string;
  content: string;
  files: AgentSkillFile[];
}

interface SkillEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: SkillFormData) => Promise<void> | void;
  initialSkill: AgentSkill | null;
}

const SkillEditorModal: React.FC<SkillEditorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSkill
}) => {
  // 简单的桌面端检测逻辑
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    // 初始化检测
    setIsDesktop(window.innerWidth >= 1024);

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const [formData, setFormData] = useState<SkillFormData>({
    name: '',
    description: '',
    content: '',
    files: []
  });

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (initialSkill) {
        // 编辑模式
        setFormData({
          name: initialSkill.name,
          description: initialSkill.description || '',
          content: initialSkill.content,
          files: initialSkill.files || []
        });
      } else {
        // 创建模式
        setFormData({
          name: '',
          description: '',
          content: '',
          files: []
        });
      }
      setActiveTab('info');
      setEditingFile(null);
    }
  }, [isOpen, initialSkill]);

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.description?.trim() || !formData.content?.trim()) {
      toast.error('请填写技能名称、描述和内容');
      return;
    }

    await onConfirm(formData);
  };

  // 文件管理相关函数
  const handleAddFile = () => {
    setEditingFile({ path: '', content: '' });
  };

  const handleSaveFile = () => {
    if (!editingFile || !editingFile.path.trim()) {
      toast.error('请输入文件路径');
      return;
    }

    setFormData(prev => {
      // 检查是否已存在同名文件（除了当前正在编辑的文件）
      const existingFileIndex = prev.files.findIndex(f => f.path === editingFile.path);
      
      let newFiles = [...prev.files];
      if (existingFileIndex >= 0) {
        // 更新现有文件
        newFiles[existingFileIndex] = editingFile;
      } else {
        // 添加新文件
        newFiles.push(editingFile);
      }
      return { ...prev, files: newFiles };
    });
    setEditingFile(null);
  };

  const handleDeleteFile = (path: string) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter(f => f.path !== path)
    }));
  };

  // 文件编辑器界面
  const FileEditor = editingFile ? (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-2">
        <button 
          className="btn btn-sm btn-ghost btn-circle"
          onClick={() => setEditingFile(null)}
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="font-bold">编辑文件</h3>
      </div>
      
      <div className="flex-1 flex flex-col gap-4">
        <label className="bub-input">
          <span className="label">文件路径 *</span>
          <input
            type="text"
            value={editingFile.path}
            onChange={(e) => setEditingFile({ ...editingFile, path: e.target.value })}
            placeholder="例如: scripts/main.py"
            className="font-mono text-sm"
          />
        </label>
        
        <div className="bub-textarea flex-1 flex flex-col">
          <span className="label">文件内容 *</span>
          <textarea
            value={editingFile.content}
            onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
            className="flex-1 w-full pt-8 font-mono text-sm resize-none"
            placeholder="输入文件内容..."
          />
        </div>
        
        <button className="btn btn-primary w-full" onClick={handleSaveFile}>
          <Check className="h-4 w-4 mr-2" />
          保存文件
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">文件列表</h3>
        <button className="btn btn-sm btn-outline" onClick={handleAddFile}>
          <Plus className="h-4 w-4 mr-1" />
          添加文件
        </button>
      </div>
      
      {formData.files.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-base-content/50 border-2 border-dashed border-base-300 rounded-lg p-8">
          <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
          <p>暂无附加文件</p>
          <p className="text-xs mt-1">支持添加脚本、引用文档或模板资源</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {formData.files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-base-100 rounded-lg border border-base-200 hover:border-primary/50 transition-colors group">
              <div 
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => setEditingFile(file)}
              >
                <FileText className="h-5 w-5 text-primary/70" />
                <div className="flex-1">
                  <div className="font-mono text-sm font-medium">{file.path}</div>
                  <div className="text-xs text-base-content/50 truncate max-w-[200px]">
                    {file.content.substring(0, 50).replace(/\n/g, ' ')}...
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-ghost btn-xs btn-circle text-error opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDeleteFile(file.path)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 表单内容
  const FormContent = (
    <InputProvider>
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="tabs tabs-boxed mb-4 bg-base-200/50 p-1">
          <a 
            className={cn("tab flex-1 transition-all", activeTab === 'info' && "tab-active bg-base-100 shadow-sm")}
            onClick={() => {
              setActiveTab('info');
              setEditingFile(null);
            }}
          >
            基本信息 & SKILL.md
          </a>
          <a 
            className={cn("tab flex-1 transition-all", activeTab === 'files' && "tab-active bg-base-100 shadow-sm")}
            onClick={() => setActiveTab('files')}
          >
            资源文件 ({formData.files.length})
          </a>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'info' ? (
            <div className="flex flex-col gap-6 h-full overflow-y-auto pb-4">
              <fieldset className='bub-fieldset'>
                <div>
                  <label className='bub-input'>
                  <span className="label">技能名称 *</span>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className=""
                    placeholder="例如: PDF 处理技能"
                    maxLength={50}
                  />
                </label>
              </div>

              <div>
                <div className='bub-textarea'>
                  <span className="label">技能描述 *</span>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full pt-8 text-sm"
                    placeholder="说明该技能适用场景、能力边界、输入输出要求等"
                  />
                </div>
              </div>

              <div>
                <div className='bub-textarea'>
                  <span className="label">技能内容 (SKILL.md) *</span>
                  <textarea
                    value={formData.content || ''}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={12}
                    className="w-full pt-8 font-mono text-sm"
                    placeholder="# Skill Instructions..."
                  />
                </div>
              </div>
            </fieldset>
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              {FileEditor}
            </div>
          )}
        </div>
      </div>
    </InputProvider>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-2xl p-0 flex flex-col bg-base-200 shadow-2xl max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">
              {initialSkill ? '编辑技能' : '创建技能'}
            </div>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {FormContent}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </button>
          </div>
        </div>
        
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      </dialog>,
      document.body
    );
  }

  // 移动端渲染
  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      debug={true}
      fullScreen={false}
      className="--testyou"
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{initialSkill ? '编辑技能' : '创建技能'}</div>}
      rightActions={[
        { 
          icon: <Check className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleSave
        }
      ]}
      leftActions={[
        {
          icon: <X className="h-5 w-5" />,
          className: 'btn btn-ghost btn-square bg-base-100',
          role: 'close'
        }
      ]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-8">
          {FormContent}
        </div>
      </div>
    </BottomSheetModal>,
    document.body
  );
};

export default SkillEditorModal;
