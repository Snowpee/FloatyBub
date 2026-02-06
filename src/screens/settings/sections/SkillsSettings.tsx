import React, { useState } from 'react';
import { useAppStore, AgentSkill } from '@/store';
import {
  Plus,
  Edit,
  Trash2,
  Zap,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import SkillEditorModal, { SkillFormData } from './SkillEditorModal';


interface SkillsSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

const SkillsSettings: React.FC<SkillsSettingsProps> = ({ onCloseModal, className }) => {
  const {
    agentSkills,
    addAgentSkill,
    updateAgentSkill,
    deleteAgentSkill
  } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    skillId: string;
    skillName: string;
  }>({ isOpen: false, skillId: '', skillName: '' });
  
  const handleEdit = (skill: AgentSkill) => {
    setEditingSkill(skill);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingSkill(null);
    setIsModalOpen(true);
  };

  const handleAddExample = () => {
    addAgentSkill({
      name: 'text-analysis',
      description: '分析文本的统计信息，如字数、行数等',
      content: '# Text Analysis Skill\n\n## When to use\nUse this skill when the user wants to count words, lines, or analyze the structure of a text block.\n\n## Instructions\n1. Use the attached script `scripts/count.py` to process the text.\n2. Report the results to the user.',
      files: [
        {
          path: 'scripts/count.py',
          content: "def analyze(text):\n    return {\n        'lines': len(text.split('\\n')),\n        'chars': len(text)\n    }"
        },
        {
          path: 'references/metrics.md',
          content: "# Metrics Definitions\n- lines: Number of newline characters + 1\n- chars: Total unicode characters"
        }
      ],
      enabled: true
    } as any);
    toast.success('已添加示例技能');
  };

  const handleModalConfirm = async (data: SkillFormData) => {
    try {
      if (editingSkill) {
        updateAgentSkill(editingSkill.id, data);
        toast.success('技能已更新');
      } else {
        addAgentSkill({
          ...data,
          enabled: true
        } as any);
        toast.success('技能已添加');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('保存技能失败:', error);
      toast.error('保存技能失败');
    }
  };

  const handleDelete = (id: string) => {
    const skill = agentSkills.find(s => s.id === id);
    setConfirmDialog({
      isOpen: true,
      skillId: id,
      skillName: skill?.name || '未知技能'
    });
  };

  const confirmDelete = async () => {
    try {
      await deleteAgentSkill(confirmDialog.skillId);
      toast.success('技能已删除');
      setConfirmDialog({ isOpen: false, skillId: '', skillName: '' });
    } catch (error) {
      console.error('删除技能失败:', error);
      toast.error(error instanceof Error ? error.message : '删除技能失败');
    }
  };

  return (
    <div className={cn("p-4 md:p-6 md:pt-0 max-w-6xl mx-auto", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <p className="text-base-content/70">
            管理 Agent Skills，赋予 AI 角色特定能力
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-outline-light md:btn-primary w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加技能
        </button>
      </div>

      {/* 技能列表 */}
      {agentSkills.length === 0 ? (
        <EmptyState 
          message="点击上方按钮创建您的第一个技能" 
          action={
            <button className="btn btn-sm btn-outline mt-4" onClick={handleAddExample}>
              导入示例技能
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {agentSkills.map((skill) => (
            <div key={skill.id} className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-col justify-between h-full pb-4 group">
                {/* 技能头部 */}
                <div className="flex items-start justify-between mb-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="card-title text-base-content">
                        {skill.name}
                      </h3>
                    </div>
                  </div>
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-sm btn-ghost">
                      <MoreVertical className="h-4 w-4" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44">
                      <li>
                        <a onClick={() => handleEdit(skill)} className="gap-3">
                          <Edit className="h-4 w-4" />
                          编辑
                        </a>
                      </li>
                      <li>
                        <a onClick={() => handleDelete(skill.id)} className="text-error">
                          <Trash2 className="h-4 w-4" />
                          删除
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 描述信息 */}
                {skill.description && (
                  <div className="mb-4">
                    <p className="text-sm text-base-content/70 line-clamp-2">
                      {skill.description}
                    </p>
                  </div>
                )}

                {/* 创建时间和按钮组 */}
                <div className="mt-auto">
                  <div className="mt-3 pt-3 border-t border-base-300 text-xs text-base-content/50 mb-3">
                    创建于 {new Date(skill.createdAt).toLocaleDateString()}
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/添加模态框 */}
      <SkillEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        initialSkill={editingSkill}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, skillId: '', skillName: '' })}
        onConfirm={confirmDelete}
        title="删除技能"
        message={`确定要删除技能 "${confirmDialog.skillName}" 吗？此操作不可撤销，使用该技能的角色将失去关联。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default SkillsSettings;
