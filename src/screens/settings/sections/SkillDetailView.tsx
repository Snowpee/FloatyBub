import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Save,
  FileText,
  Trash2,
  Plus,
  FolderOpen,
  Check,
  X
} from 'lucide-react';
import { InputProvider } from '@/components/InputProvider';
import { AgentSkill, AgentSkillFile } from '@/store';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import BottomSheetModal from '@/components/BottomSheetModal';

export interface SkillFormData {
  name: string;
  description: string;
  content: string;
  files: AgentSkillFile[];
}

interface SkillDetailViewProps {
  initialSkill: AgentSkill | null;
  onSave: (data: SkillFormData) => Promise<void> | void;
  onClose: () => void; // 用于返回列表
  className?: string;
}

// 文件编辑弹窗组件
interface FileEditorModalProps {
  isOpen: boolean;
  file: { path: string; content: string } | null;
  onClose: () => void;
  onSave: (file: { path: string; content: string }) => void;
}

const FileEditorModal: React.FC<FileEditorModalProps> = ({
  isOpen,
  file,
  onClose,
  onSave
}) => {
  const [editingFile, setEditingFile] = useState<{ path: string; content: string }>({ path: '', content: '' });
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 1024);
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    if (isOpen && file) {
      setEditingFile(file);
    } else if (isOpen) {
      setEditingFile({ path: '', content: '' });
    }
  }, [isOpen, file]);

  const handleSave = () => {
    if (!editingFile.path.trim()) {
      toast.error('请输入文件路径');
      return;
    }
    onSave(editingFile);
    onClose();
  };

  const content = (
    <InputProvider>
      <div className="flex flex-col h-full p-4 md:p-6">
        <fieldset className="bub-fieldset flex-1 flex flex-col">
          <div>
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
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bub-textarea flex-1 flex flex-col">
              <span className="label">文件内容 *</span>
              <textarea
                rows={24}
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className="flex-1 w-full pt-8 font-mono text-sm resize-none"
                placeholder="输入文件内容..."
              />
            </div>
          </div>
        </fieldset>
      </div>
    </InputProvider>
  );

  if (!isOpen) return null;

  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-2xl p-0 flex flex-col bg-base-200 shadow-2xl">
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <h3 className="text-lg font-bold">{file?.path ? '编辑文件' : '添加文件'}</h3>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {content}
          </div>
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

  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      onOpenChange={(open) => !open && onClose()}
      dismissible={true}
      dragEnabled={true}
      headerTitle={<div className="text-center text-lg font-semibold">{file?.path ? '编辑文件' : '添加文件'}</div>}
      rightActions={[{ 
        icon: <Check className="h-5 w-5" />, 
        className: 'btn btn-primary btn-square', 
        onClick: handleSave
      }]}
      leftActions={[{
        icon: <X className="h-5 w-5" />,
        className: 'btn btn-ghost btn-square bg-base-100',
        role: 'close'
      }]}
    >
      <div className="flex-1 overflow-hidden h-full">
        {content}
      </div>
    </BottomSheetModal>,
    document.body
  );
};

const SkillDetailView: React.FC<SkillDetailViewProps> = ({
  initialSkill,
  onSave,
  onClose,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');
  const [formData, setFormData] = useState<SkillFormData>({
    name: '',
    description: '',
    content: '',
    files: []
  });
  
  // 文件编辑状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    if (initialSkill) {
      setFormData({
        name: initialSkill.name,
        description: initialSkill.description || '',
        content: initialSkill.content,
        files: initialSkill.files || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        content: '',
        files: []
      });
    }
    setActiveTab('info');
  }, [initialSkill?.id]);

  const handleSaveSkill = async () => {
    if (!formData.name?.trim() || !formData.description?.trim() || !formData.content?.trim()) {
      toast.error('请填写技能名称、描述和内容');
      return;
    }
    await onSave(formData);
  };

  const handleAddFile = () => {
    setEditingFile(null); // null 表示新建
    setIsEditorOpen(true);
  };

  const handleEditFile = (file: AgentSkillFile) => {
    setEditingFile(file);
    setIsEditorOpen(true);
  };

  const handleFileSave = (file: { path: string; content: string }) => {
    setFormData(prev => {
      // 这里的逻辑有点问题：如果是编辑现有文件，path可能变了。
      // 简单起见，如果 editingFile 存在且 path 不同，说明改名了？
      // 或者我们假设 editingFile 是旧值的引用。
      
      // 更好的方式：
      // 如果是新建（editingFile为null），直接 push（需检查重名）。
      // 如果是编辑（editingFile不为null），找到原来的位置更新。
      // 但这里 file 是新值。我们需要知道“原来”是谁。
      
      // 重新调整逻辑：
      // 编辑时，我们把 file 传给 modal。保存回来时，如果是新建，就 push。
      // 如果是编辑，我们需要知道正在编辑的是哪个索引，或者原来的 path。
      // 简化逻辑：先删除旧的（如果 path 变了），再添加新的？
      // 不，这太复杂。
      // 我们暂定：path 是主键。如果 path 没变，就是更新。如果 path 变了，就是新建（需删除旧的）。
      // 这里为了简单，我们传入 editingFile 作为“原始参考”。
      
      let newFiles = [...prev.files];
      
      // 如果是编辑模式（editingFile 不为 null）
      if (editingFile) {
        // 找到原来的文件索引
        const idx = newFiles.findIndex(f => f.path === editingFile.path);
        if (idx !== -1) {
            // 如果 path 变了，检查新 path 是否冲突
            if (file.path !== editingFile.path && newFiles.some(f => f.path === file.path)) {
                toast.error('文件名已存在');
                return prev;
            }
            newFiles[idx] = file;
        } else {
            // 理论上不该发生，除非原来的文件被删了
            newFiles.push(file);
        }
      } else {
        // 新建模式
        if (newFiles.some(f => f.path === file.path)) {
            toast.error(`文件 "${file.path}" 已存在，请先删除或使用不同名称`);
            return prev;
        } else {
            newFiles.push(file);
        }
      }
      return { ...prev, files: newFiles };
    });
    setIsEditorOpen(false);
  };

  const handleDeleteFile = (path: string) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter(f => f.path !== path)
    }));
  };

  return (
    <InputProvider>
      <div className={cn("flex flex-col h-full bg-base-200", className)}>
        {/* 顶部操作栏 - 仅在移动端或需要时显示额外的保存按钮 */}
        <div className="flex justify-between items-center mb-4 px-1">
             <div className="tabs tabs-boxed bg-base-100 p-1">
                <a 
                    className={cn("tab transition-all", activeTab === 'info' && "tab-active bg-base-200 shadow-sm")}
                    onClick={() => setActiveTab('info')}
                >
                    基本信息
                </a>
                <a 
                    className={cn("tab transition-all", activeTab === 'files' && "tab-active bg-base-200 shadow-sm")}
                    onClick={() => setActiveTab('files')}
                >
                    资源文件 ({formData.files.length})
                </a>
            </div>

            <button className="btn btn-primary btn-sm" onClick={handleSaveSkill}>
              <Save className="h-4 w-4 mr-1" />
              保存变更
            </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'info' ? (
            <div className="flex flex-col gap-6 h-full overflow-y-auto pb-4 px-1">
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
            <div className="flex flex-col h-full px-1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-base-content/70">文件列表</h3>
                <button className="btn btn-sm btn-outline" onClick={handleAddFile}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加文件
                </button>
              </div>
              
              {formData.files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-base-content/50 border-2 border-dashed border-base-300 rounded-lg p-8 bg-base-100/50">
                  <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
                  <p>暂无附加文件</p>
                  <p className="text-xs mt-1">支持添加脚本、引用文档或模板资源</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {formData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-base-100 rounded-lg border border-base-300 hover:border-primary/50 transition-colors group">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleEditFile(file)}
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
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.path);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 文件编辑弹窗 */}
        <FileEditorModal 
            isOpen={isEditorOpen}
            file={editingFile}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleFileSave}
        />
      </div>
    </InputProvider>
  );
};

export default SkillDetailView;
