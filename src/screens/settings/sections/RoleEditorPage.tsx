import { useContext, useEffect, useState } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useAppStore, type AIRole } from '@/store';
import { KnowledgeService } from '@/services/knowledgeService';
import type { KnowledgeBase } from '@/types/knowledge';
import { toast } from '@/hooks/useToast';
import { SettingsNavigationContext } from '../SettingsNavigationContext';
import RolesModal, { type RoleFormData } from './RolesModal';

export default function RoleEditorPage({ roleId }: { roleId?: string }) {
  const navigation = useContext(SettingsNavigationContext);
  const role = useAppStore(state => state.aiRoles.find(item => item.id === roleId)) ?? null;
  const [data, setData] = useState<{ bases: KnowledgeBase[]; selected: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void Promise.all([KnowledgeService.getKnowledgeBases(), roleId ? KnowledgeService.getRoleKnowledgeBaseId(roleId) : Promise.resolve(null)])
      .then(([bases, selected]) => { if (active) setData({ bases, selected }); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [roleId, attempt]);
  const save = async (form: RoleFormData) => {
    const { knowledgeBaseId, ...values } = form;
    const store = useAppStore.getState();
    let createdId: string | undefined;
    try {
      // Preserve the existing role if saving its knowledge association fails.
      if (roleId) {
        await KnowledgeService.setRoleKnowledgeBase(roleId, knowledgeBaseId || null);
        store.updateAIRole(roleId, values);
      } else {
        const created = store.addAIRole(values as Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>);
        createdId = created.id;
        await KnowledgeService.setRoleKnowledgeBase(created.id, knowledgeBaseId || null);
      }
      toast.success(roleId ? '角色更新成功' : '角色创建成功');
      navigation?.setBackNavigationGuard?.(null);
      navigation?.pop();
    } catch (error) {
      if (createdId) {
        try { await store.deleteAIRole(createdId); }
        catch (rollbackError) {
          console.error('回滚角色失败:', rollbackError);
          toast.error('角色已创建，但知识库关联失败，请返回列表检查后重试');
          navigation?.setBackNavigationGuard?.(null);
          navigation?.pop();
          return;
        }
      }
      console.error('保存角色失败:', error);
      toast.error('保存失败，请重试');
    }
  };
  if (!data || (roleId && !role)) return <>
    <IonHeader><IonToolbar><IonButtons slot="start"><IonButton onClick={() => navigation?.pop()}>返回</IonButton></IonButtons><IonTitle>{roleId ? '编辑角色' : '创建角色'}</IonTitle></IonToolbar></IonHeader>
    <IonContent><div className="role-editor-status">{roleId && !role ? '角色已不存在' : failed ? <><p>无法加载角色配置，请重试。</p><IonButton onClick={() => setAttempt(value => value + 1)}>重试</IonButton></> : <><IonSpinner /><p>正在加载角色配置…</p></>}</div></IonContent>
  </>;
  return <RolesModal page isOpen onClose={() => navigation?.pop()} onConfirm={save} initialRole={role} initialKnowledgeBaseId={data.selected} knowledgeBases={data.bases} />;
}
