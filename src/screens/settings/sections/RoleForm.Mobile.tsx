import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { IonButton, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonItemGroup, IonReorder, IonReorderGroup, IonNote, IonSelect, IonSelectOption, IonTextarea } from '@ionic/react';
import { useAppStore } from '@/store';
import type { KnowledgeBase } from '@/types/knowledge';
import RoleAvatarUpload from '../components/RoleAvatarUpload';
import type { RoleFormData } from './RolesModal';

type Props = { value: RoleFormData; onChange: Dispatch<SetStateAction<RoleFormData>>; knowledgeBases: KnowledgeBase[]; disabled: boolean };
function Group({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <IonList inset mode="ios"><IonListHeader><IonLabel>{title}</IonLabel></IonListHeader><IonItemGroup>{children}</IonItemGroup>{note && <IonNote className="role-form-note">{note}</IonNote>}</IonList>;
}
export default function RoleFormMobile({ value, onChange, knowledgeBases, disabled }: Props) {
  const { globalPrompts, agentSkills, voiceSettings } = useAppStore();
  const patch = (next: Partial<RoleFormData>) => onChange(previous => ({ ...previous, ...next }));
  const selected = (field: 'globalPromptIds' | 'skillIds', title: string, options: { id: string; name: string }[]) => <Group title={title} note="按列表顺序应用，拖动右侧手柄可排序。">
    <IonItem><IonSelect label={title} labelPlacement="start" multiple interface="alert" cancelText="取消" okText="完成" disabled={disabled} value={value[field]} onIonChange={event => {
      const ids = event.detail.value as string[];
      patch({ [field]: [...value[field].filter(id => ids.includes(id)), ...ids.filter(id => !value[field].includes(id))] });
    }}>{options.map(option => <IonSelectOption key={option.id} value={option.id}>{option.name}</IonSelectOption>)}</IonSelect></IonItem>
    <IonReorderGroup disabled={disabled} onIonItemReorder={event => {
      const ids = [...value[field]];
      const [id] = ids.splice(event.detail.from, 1);
      ids.splice(event.detail.to, 0, id);
      patch({ [field]: ids });
      event.detail.complete();
    }}>{value[field].map(id => <IonItem key={id}><IonLabel className="ion-text-wrap">{options.find(option => option.id === id)?.name || '已失效项目'}</IonLabel>
      <IonReorder slot="end" aria-label="拖动排序" />
    </IonItem>)}</IonReorderGroup>
  </Group>;
  return <div className="role-form-mobile">
    <div className="role-form-avatar"><RoleAvatarUpload ionic name={value.name || '新角色'} currentAvatar={value.avatar} onAvatarChange={avatar => patch({ avatar: avatar || '' })} /></div>
    <Group title="基本信息">
      <IonItem><IonInput label="角色名称（必填）" labelPlacement="stacked" placeholder="例如：编程助手" value={value.name} disabled={disabled} onIonInput={event => patch({ name: event.detail.value ?? '' })} /></IonItem>
      <IonItem><IonTextarea label="角色描述" labelPlacement="stacked" placeholder="简要描述角色的特点和用途" autoGrow rows={2} value={value.description} disabled={disabled} onIonInput={event => patch({ description: event.detail.value ?? '' })} /></IonItem>
    </Group>
    <Group title="角色提示词" note="定义角色的身份、行为方式和回答风格。">
      <IonItem><IonTextarea label="提示词" labelPlacement="stacked" placeholder="你是一个专业的编程助手……" rows={6} value={value.systemPrompt} disabled={disabled} onIonInput={event => patch({ systemPrompt: event.detail.value ?? '' })} /></IonItem>
    </Group>
    <Group title="开场白" note="支持多个开场白；新建对话时显示角色的第一句话。">
      {value.openingMessages.map((message, index) => <IonItem key={index}>
        <IonTextarea label={`开场白 ${index + 1}`} labelPlacement="stacked" autoGrow rows={3} value={message} disabled={disabled} onIonInput={event => patch({ openingMessages: value.openingMessages.map((text, i) => i === index ? event.detail.value ?? '' : text) })} />
        {value.openingMessages.length > 1 && <IonButton slot="end" fill="clear" color="danger" disabled={disabled} aria-label={`删除开场白 ${index + 1}`} onClick={() => patch({ openingMessages: value.openingMessages.filter((_, i) => i !== index), currentOpeningIndex: Math.min(value.currentOpeningIndex, value.openingMessages.length - 2) })}>删除</IonButton>}
      </IonItem>)}
      <IonItem button detail={false} disabled={disabled} onClick={() => patch({ openingMessages: [...value.openingMessages, ''] })}><IonLabel color="primary">添加开场白</IonLabel></IonItem>
    </Group>
    {selected('globalPromptIds', '附加提示词', globalPrompts.map(prompt => ({ id: prompt.id, name: prompt.title })))}
    {selected('skillIds', '角色技能', agentSkills.map(skill => ({ id: skill.id, name: skill.name })))}
    <Group title="知识库">
      <IonItem><IonSelect label="关联知识库" labelPlacement="stacked" value={value.knowledgeBaseId} disabled={disabled} interface="action-sheet" cancelText="取消" onIonChange={event => patch({ knowledgeBaseId: event.detail.value })}><IonSelectOption value="">不使用知识库</IonSelectOption>{knowledgeBases.map(base => <IonSelectOption key={base.id} value={base.id}>{base.name}</IonSelectOption>)}</IonSelect></IonItem>
    </Group>
    <Group title="回复与语音" note="语音回复需要可用的语音模型；延迟均设为 0 可立即回复。">
      <IonItem><IonSelect label="默认回复方式" value={value.replyMode} disabled={disabled} interface="action-sheet" cancelText="取消" onIonChange={event => patch({ replyMode: event.detail.value })}><IonSelectOption value="text">文字</IonSelectOption><IonSelectOption value="voice-text">语音与文字</IonSelectOption><IonSelectOption value="voice">纯语音</IonSelectOption></IonSelect></IonItem>
      <IonItem><IonSelect label="语音模型" value={value.voiceModelId} disabled={disabled} interface="action-sheet" cancelText="取消" onIonChange={event => patch({ voiceModelId: event.detail.value })}><IonSelectOption value="">默认</IonSelectOption>{voiceSettings?.customModels?.map(model => <IonSelectOption key={model.id} value={model.id}>{model.name}</IonSelectOption>)}</IonSelect></IonItem>
      {value.replyMode !== 'text' && <>
        <IonItem><IonInput label="最短回复延迟（秒）" type="number" inputmode="decimal" min="0" max="60" step="0.5" value={value.replyDelayMinSeconds} disabled={disabled} onIonInput={event => patch({ replyDelayMinSeconds: Number(event.detail.value) })} /></IonItem>
        <IonItem><IonInput label="最长回复延迟（秒）" type="number" inputmode="decimal" min="0" max="60" step="0.5" value={value.replyDelayMaxSeconds} disabled={disabled} onIonInput={event => patch({ replyDelayMaxSeconds: Number(event.detail.value) })} /></IonItem>
      </>}
    </Group>
  </div>;
}
