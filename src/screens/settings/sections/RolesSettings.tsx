import React, { useState, useEffect, useRef, useContext } from 'react';
import { IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonSearchbar, IonTitle, IonToolbar, IonBackButton } from '@ionic/react';
import { chevronBack } from 'ionicons/icons';
import { SettingsNavigationContext } from '../SettingsNavigationContext';
import RoleEditorPage from './RoleEditorPage';
import './roles-settings-mobile.css';
import { useAppStore, AIRole } from '@/store';
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeFormatDate } from '@/utils/dateUtils';
import { toast } from '@/hooks/useToast';
import ConfirmDialog from '@/components/ConfirmDialog';
import Avatar from '@/components/Avatar';
import { KnowledgeService } from '@/services/knowledgeService';
import type { KnowledgeBase } from '@/types/knowledge';
import RolesModal, { RoleFormData } from './RolesModal';

interface RolesSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

const RolesSettings: React.FC<RolesSettingsProps> = ({ className }) => {
  const navigation = useContext(SettingsNavigationContext);
  const [query, setQuery] = useState('');
  const {
    aiRoles,
    addAIRole,
    updateAIRole,
    deleteAIRole
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKnowledgeBaseId, setEditingKnowledgeBaseId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    roleId: string;
    roleName: string;
  }>({ isOpen: false, roleId: '', roleName: '' });
  
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const activeRoleIdRef = useRef<string | null>(null);

  const defaultRoles = [
    '00000000-0000-4000-8000-000000000001', // AI助手
    'default-assistant',
    'code-expert',
    'creative-writer'
  ];

  // 加载知识库列表
  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        const bases = await KnowledgeService.getKnowledgeBases();
        setKnowledgeBases(bases);
      } catch (error) {
        console.error('加载知识库列表失败:', error);
      }
    };
    loadKnowledgeBases();
  }, []);

  const handleEdit = (role: AIRole) => {
    if (navigation) { navigation.push(RoleEditorPage, { roleId: role.id }, { layout: 'ionic' }); return; }
    // 立即响应用户操作
    setEditingId(role.id);
    setIsEditing(true);
    setEditingKnowledgeBaseId(null);
    activeRoleIdRef.current = role.id;

    // 异步加载知识库关联
    KnowledgeService.getRoleKnowledgeBaseId(role.id)
      .then(kbId => {
        if (activeRoleIdRef.current === role.id) {
          setEditingKnowledgeBaseId(kbId);
        }
      })
      .catch(error => {
        console.error('加载角色知识库关联失败:', error);
        if (activeRoleIdRef.current === role.id) {
          setEditingKnowledgeBaseId(null);
        }
      });
  };

  const handleAdd = () => {
    if (navigation) { navigation.push(RoleEditorPage, {}, { layout: 'ionic' }); return; }
    setEditingId(null);
    setEditingKnowledgeBaseId(null);
    setIsEditing(true);
    activeRoleIdRef.current = null;
  };

  const handleSave = async (formData: RoleFormData) => {
    try {
      let roleId: string;
      const { knowledgeBaseId, ...roleData } = formData;
      
      if (editingId) {
        updateAIRole(editingId, roleData);
        roleId = editingId;
        toast.success('角色更新成功');
      } else {
        const newRole = addAIRole(roleData as unknown as Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>);
        roleId = newRole.id;
        toast.success('角色创建成功');
      }

      // 保存知识库关联
      if (knowledgeBaseId) {
        await KnowledgeService.setRoleKnowledgeBase(roleId, knowledgeBaseId);
      } else {
        // 如果没有选择知识库，清除关联
        await KnowledgeService.setRoleKnowledgeBase(roleId, null);
      }

      closeEditModal();
    } catch (error) {
      console.error('保存角色失败:', error);
      toast.error('保存角色失败');
    }
  };

  const closeEditModal = () => {
    setIsEditing(false);
    setEditingId(null);
    activeRoleIdRef.current = null;
  };

  const handleDelete = (id: string) => {
    if (defaultRoles.includes(id)) {
      toast.error('默认角色不能删除');
      return;
    }

    const role = aiRoles.find(r => r.id === id);
    setConfirmDialog({
      isOpen: true,
      roleId: id,
      roleName: role?.name || '未知角色'
    });
  };

  const confirmDelete = async () => {
    try {
      await deleteAIRole(confirmDialog.roleId);
      toast.success('角色已删除');
      setConfirmDialog({ isOpen: false, roleId: '', roleName: '' });
    } catch (error) {
      console.error('删除角色失败:', error);
      toast.error(error instanceof Error ? error.message : '删除角色失败');
    }
  };

  const getRoleTypeLabel = (id: string) => {
    if (defaultRoles.includes(id)) {
      return '系统角色';
    }
    return '自定义角色';
  };

  const editingRole = editingId ? aiRoles.find(r => r.id === editingId) || null : null;

  if (navigation) {
    const visible = aiRoles.filter(role => `${role.name} ${role.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <>
      <IonHeader><IonToolbar>
        <IonButtons slot="start"><IonBackButton mode="ios" text="" icon={chevronBack} defaultHref="#setting" aria-label="返回设置" /></IonButtons>
        <IonTitle>角色卡</IonTitle>
        <IonButtons slot="end"><IonButton onClick={handleAdd} aria-label="创建角色"><Plus size={22} /></IonButton></IonButtons>
      </IonToolbar></IonHeader>
      <IonContent><div className="roles-settings-mobile">
        <p className="roles-intro">为每个角色赋予独特的性格与能力</p>
        <IonSearchbar value={query} onIonInput={event => setQuery(event.detail.value ?? '')} placeholder="搜索角色" aria-label="搜索角色" />
        <div className="roles-card-grid">{visible.map(role => <IonCard key={role.id}>
          <button type="button" className="role-card-open" onClick={() => handleEdit(role)} aria-label={`编辑角色 ${role.name}`}>
            <IonCardHeader><div className="role-card-heading"><Avatar name={role.name} avatar={role.avatar} size="lg" /><div><IonCardTitle>{role.name}</IonCardTitle><IonCardSubtitle>{getRoleTypeLabel(role.id)}</IonCardSubtitle></div></div></IonCardHeader>
            <IonCardContent><p className="role-card-description">{role.description || '尚未添加描述，点击完善角色设定'}</p><div className="role-card-meta"><span>{role.replyMode === 'voice' ? '纯语音' : role.replyMode === 'voice-text' ? '语音与文字' : '文字对话'}</span><span>{role.skillIds?.length || 0} 项技能</span></div></IonCardContent>
          </button>
          <div className="role-card-footer"><span>创建于 {safeFormatDate(role.createdAt)}</span>{!defaultRoles.includes(role.id) && <IonButton fill="clear" color="danger" size="small" aria-label={`删除角色 ${role.name}`} onClick={() => handleDelete(role.id)}><Trash2 size={16} /></IonButton>}</div>
        </IonCard>)}</div>
        {!visible.length && <div className="role-editor-status"><p>{query ? '没有找到匹配的角色' : '还没有角色，创建你的第一个角色吧'}</p>{!query && <IonButton onClick={handleAdd}>创建角色</IonButton>}</div>}
      </div></IonContent>
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ isOpen: false, roleId: '', roleName: '' })} onConfirm={confirmDelete} title="删除角色" message={`确定要删除角色「${confirmDialog.roleName}」吗？此操作不可撤销。`} confirmText="删除" cancelText="取消" variant="danger" />
    </>;
  }

  return (
    <div className={cn("max-w-6xl mx-auto p-4 md:p-6 md:pt-0", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <p className="text-base-content/60">
            创建和管理AI角色，定义不同的对话风格和专业领域
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-outline-light md:btn-primary w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          创建新角色
        </button>
      </div>

      {/* 角色网格 */}
      <div className="grid gap-4 md:grid-cols-2">
        {aiRoles.map((role) => {
          const isDefault = defaultRoles.includes(role.id);

          return (
            <div
              key={role.id}
              className={cn(
                'card bg-base-100 shadow-sm hover:shadow-md transition-all duration-200'
              )}
            >
              <div className="card-body pb-4 group">
              {/* 角色头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Avatar
                    name={role.name}
                    avatar={role.avatar}
                    size="lg"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-base-content">
                      {role.name}
                    </h3>
                    <span className={cn(
                      'text-base-content/40 text-xs',
                      isDefault ? 'badge-primary' : ''
                    )}>
                      {getRoleTypeLabel(role.id)}
                    </span>
                  </div>
                </div>
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-44 p-2 shadow-lg">
                    <li>
                      <a onClick={() => handleEdit(role)} className="gap-3">
                        <Edit className="h-4 w-4" />
                        编辑
                      </a>
                    </li>
                    {!isDefault && (
                      <li>
                        <a onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(role.id);
                        }}
                          className="gap-3 text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </a>
                      </li>
                    )}
                  </ul>
                </div>                

              </div>

              {/* 角色描述 */}
              <div className="border-t border-base-300">
                <p className="text-sm text-base-content/60 line-clamp-2 overflow-hidden text-ellipsis pt-4">
                      {role.description || '暂无描述'}
                </p>
              </div>
              <div className="text-xs text-base-content/30 mt-auto">
                创建于 {safeFormatDate(role.createdAt)}
              </div>
              {/* 创建时间和当前角色toggle */}
              </div>
            </div>
          );
        })}
      </div>

      {/* 编辑/添加模态框：替换为 RolesModal */}
      <RolesModal
        isOpen={isEditing}
        onClose={closeEditModal}
        onConfirm={handleSave}
        initialRole={editingRole}
        initialKnowledgeBaseId={editingKnowledgeBaseId}
        knowledgeBases={knowledgeBases}
      />

      {/* 删除确认弹窗（统一使用 ConfirmDialog） */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, roleId: '', roleName: '' })}
        onConfirm={confirmDelete}
        title="删除角色"
        message={`确定要删除角色 "${confirmDialog.roleName}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default RolesSettings;
