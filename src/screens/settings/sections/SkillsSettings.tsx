import React, { useState, useMemo, useContext } from 'react';
import { useAppStore, AgentSkill } from '@/store';
import {
  Plus,
  Edit,
  Trash2,
  Zap,
  MoreVertical,
  ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import { safeFormatDate } from '@/utils/dateUtils';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import SkillDetailView, { SkillFormData } from './SkillDetailView';
import { NavLink, BackButton } from '@/components/navigation/MobileNav';
import { DragContext } from '@/screens/settings/SettingsContext';

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

  const [showDetailView, setShowDetailView] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    skillId: string;
    skillName: string;
  }>({ isOpen: false, skillId: '', skillName: '' });

  // 桌面端处理进入详情
  const handleOpenDetail = (skill: AgentSkill | null) => {
    setEditingSkill(skill);
    setShowDetailView(true);
  };

  // 关闭详情（返回列表）
  const handleCloseDetail = () => {
    setShowDetailView(false);
    setEditingSkill(null);
  };

  const handleSaveSkill = async (data: SkillFormData) => {
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
        handleCloseDetail(); // 创建成功后返回列表
      }
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
      // 如果正在编辑该技能，则退出编辑
      if (editingSkill && editingSkill.id === confirmDialog.skillId) {
        handleCloseDetail();
      }
    } catch (error) {
      console.error('删除技能失败:', error);
      toast.error(error instanceof Error ? error.message : '删除技能失败');
    }
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

  return (
    <div 
      className={cn("p-4 md:p-6 md:pt-0 max-w-6xl mx-auto", className)}
      data-skills-page
      data-is-detail-view={showDetailView ? 'true' : 'false'}
      data-detail-title={editingSkill ? editingSkill.name : '创建技能'}
    >
      {/* 隐藏的返回按钮，供SettingsModal调用 */}
      <button
        data-back-button
        onClick={handleCloseDetail}
        className="hidden"
        aria-hidden="true"
      />

      {!showDetailView ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <p className="text-base-content/70">
                管理 Agent Skills，赋予 AI 角色特定能力
              </p>
            </div>
            
            {/* 添加按钮：Mobile使用NavLink，Desktop使用onClick */}
            {typeof window !== 'undefined' && window.innerWidth < 768 ? (
                <NavLink
                    component={SkillDetailMobilePage as any}
                    props={{ initialSkill: null }}
                    className="btn btn-outline-light md:btn-primary w-full md:w-auto"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    添加技能
                </NavLink>
            ) : (
                <button
                onClick={() => handleOpenDetail(null)}
                className="btn btn-outline-light md:btn-primary w-full md:w-auto"
                >
                <Plus className="h-4 w-4 mr-2" />
                添加技能
                </button>
            )}
          </div>

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
                    <div className="flex items-start justify-between mb-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="card-title text-base-content">
                            {skill.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-base-content/30 mt-1">
                            <span>创建于 {safeFormatDate(skill.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-sm btn-ghost">
                          <MoreVertical className="h-4 w-4" />
                        </label>
                        <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44">
                          <li>
                             {typeof window !== 'undefined' && window.innerWidth < 768 ? (
                                <NavLink
                                    component={SkillDetailMobilePage as any}
                                    props={{ initialSkill: skill }}
                                    className="gap-3"
                                >
                                    <Edit className="h-4 w-4" />
                                    编辑
                                </NavLink>
                            ) : (
                                <a onClick={() => handleOpenDetail(skill)} className="gap-3">
                                <Edit className="h-4 w-4" />
                                编辑
                                </a>
                            )}
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

                    {skill.description && (
                      <div className="mb-4 mt-2">
                        <p className="text-sm text-base-content/70 line-clamp-2">
                          {skill.description}
                        </p>
                      </div>
                    )}

                    <div className="card-actions justify-end mt-4">
                       {typeof window !== 'undefined' && window.innerWidth < 768 ? (
                            <NavLink
                                component={SkillDetailMobilePage as any}
                                props={{ initialSkill: skill }}
                                className="btn btn-sm"
                            >
                                查看详情
                            </NavLink>
                        ) : (
                            <button className="btn btn-sm" onClick={() => handleOpenDetail(skill)}>查看详情</button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <SkillDetailView
          initialSkill={editingSkill}
          onSave={handleSaveSkill}
          onClose={handleCloseDetail}
          className="h-full"
        />
      )}

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

// 移动端详情页包装组件
const SkillDetailMobilePage: React.FC<{ initialSkill: AgentSkill | null }> = ({ initialSkill }) => {
  const { bind } = useContext(DragContext);
  const { addAgentSkill, updateAgentSkill } = useAppStore();

  // 由于 MobilePage 是独立组件，我们需要自己处理保存逻辑
  // 这里逻辑与 PC 端类似，但没有 setShowDetailView
  const handleSaveSkill = async (data: SkillFormData) => {
    try {
      if (initialSkill) {
        updateAgentSkill(initialSkill.id, data);
        toast.success('技能已更新');
      } else {
        addAgentSkill({
          ...data,
          enabled: true
        } as any);
        toast.success('技能已添加');
        // 保存后留在当前页，或者如果能返回更好。但 NavLink 没有提供 pop 方法。
        // 用户可以点击左上角返回。
      }
    } catch (error) {
      console.error('保存技能失败:', error);
      toast.error('保存技能失败');
    }
  };

  return (
    <div className="flex flex-col overflow-hidden h-full bg-base-200 p-4 md:p-6 md:pt-0">
      <div 
        {...bind()}
        className={cn(
          "px-2 flex items-start gap-3 h-[var(--height-header-m)] shrink-0",
          "cursor-move select-none",
          "md:touch-auto touch-none"
        )}
      >
        <div className="flex w-10 h-10 items-center justify-center">
          <BackButton className="btn btn-circle bg-base-100">
            <ChevronLeft className="h-5 w-5" />
          </BackButton>
        </div>
        <h2 className="text-lg font-semibold text-base-content h-10 items-center justify-center flex w-[calc(100%-2rem)]">
            {initialSkill ? initialSkill.name : '创建技能'}
        </h2>
        <div className="flex w-10 h-10 items-center justify-center">
        </div>
      </div>
      <div className="flex-1 overflow-y-scroll overscroll-contain">
        <div className='h-[calc(100vh-var(--height-header-m)-env(safe-area-inset-top)-env(safe-area-inset-bottom)+1px)]'>
            <SkillDetailView
                initialSkill={initialSkill}
                onSave={handleSaveSkill}
                onClose={() => {}} // Mobile 端由 BackButton 控制，这里为空
                className="h-full"
            />
        </div>
      </div>
    </div>
  );
};

export default SkillsSettings;
