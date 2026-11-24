import { useContext } from 'react';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonItemGroup, IonLabel, IonList,
  IonListHeader, IonNote, IonRadio, IonRadioGroup, IonTitle, IonToggle, IonToolbar,
} from '@ionic/react';
import { chevronBack } from 'ionicons/icons';
import { useAppStore } from '@/store';
import { SettingsNavigationContext } from '@/screens/settings/SettingsNavigationContext';
import type { GlobalSettingsProps } from './GlobalSettings';
import './global-settings-mobile.css';

type ChoiceKind = 'display' | 'theme' | 'assistant' | 'role' | 'shortcut';
const titles: Record<ChoiceKind, string> = {
  display: '显示方式', theme: '主题', assistant: '全局辅助模型', role: '默认角色', shortcut: '发送快捷键',
};
const themes = [
  { value: 'floaty', label: '浮光', description: '默认主题', colors: ['#ffffff', '#fafafa', '#27c2df', '#25252b'] },
  { value: 'light', label: '简洁', description: '清爽的浅色界面', colors: ['#ffffff', '#f5f5f5', '#422ad5', '#18181b'] },
  { value: 'dark', label: '暗色', description: '深色背景与浅色文字', colors: ['#1d232a', '#191e24', '#7480ff', '#a6adbb'] },
  { value: 'cupcake', label: '纸杯蛋糕', description: '柔和的彩色界面', colors: ['#faf7f5', '#efeae6', '#65c3c8', '#291334'] },
] as const;
const systemRoleIds = new Set(['00000000-0000-4000-8000-000000000001', 'default-assistant', 'code-expert', 'creative-writer']);

function shortcutLabel() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(`${navigator.platform} ${navigator.userAgent}`)
    ? '⌘ + Return' : 'Ctrl + Enter';
}

function useGlobalChoices() {
  const state = useAppStore();
  const assistant = state.assistantConfig || state.autoTitleConfig;
  const roles = [...state.aiRoles].sort((a, b) => Number(systemRoleIds.has(b.id)) - Number(systemRoleIds.has(a.id)));
  const model = state.llmConfigs.find(item => item.id === assistant?.modelId && item.enabled);
  return { state, assistant, roles, assistantLabel: assistant?.strategy === 'follow'
    ? '跟随当前会话模型' : model ? (model.name || `${model.provider}:${model.model}`) : '未指定可用模型' };
}

// A standard Ionic page body, wrapped by the shared IonNav exactly once.
export function GlobalChoicePage({ kind }: { kind: ChoiceKind }) {
  const { state, assistant, roles } = useGlobalChoices();
  const options = kind === 'display' ? [
    { value: 'conversation', label: '对话', description: '以气泡呈现消息，适合日常对话' },
    { value: 'document', label: '文档', description: '以连续文档呈现内容，适合阅读长回复' },
  ] : kind === 'theme' ? themes : kind === 'assistant' ? [
    { value: 'follow', label: '跟随当前会话模型', description: '使用当前聊天选择的模型' },
    ...state.llmConfigs.filter(model => model.enabled).map(model => ({
      value: model.id, label: model.name || `${model.provider}:${model.model}`, description: model.model,
    })),
  ] : kind === 'role' ? [
    { value: '', label: '不指定默认角色', description: '新对话不预选角色' },
    ...roles.map(role => ({ value: role.id, label: role.name, description: systemRoleIds.has(role.id) ? '系统角色' : undefined })),
  ] : [
    { value: 'ctrlEnter', label: shortcutLabel(), description: '组合键发送，Return 换行' },
    { value: 'enter', label: 'Return', description: 'Return 发送，Shift + Return 换行' },
  ];
  const selected = kind === 'display' ? state.chatStyle : kind === 'theme' ? state.theme : kind === 'role' ? state.defaultRoleId || ''
    : kind === 'shortcut' ? state.sendMessageShortcut
    : assistant?.strategy === 'follow' ? 'follow' : assistant?.modelId || '';
  const select = (value: unknown) => {
    // Ionic may emit values during component setup; only accept listed choices.
    if (typeof value !== 'string' || !options.some(option => option.value === value)) return;
    if (kind === 'display' && (value === 'conversation' || value === 'document')) {
      state.setChatStyle(value);
    } else if (kind === 'theme' && themes.some(theme => theme.value === value)) {
      state.setTheme(value as typeof state.theme);
    } else if (kind === 'assistant') {
      state.updateAssistantConfig(value === 'follow'
        ? { strategy: 'follow', modelId: null } : { strategy: 'custom', modelId: value });
    } else if (kind === 'role') {
      state.setDefaultRoleId(value || null);
    } else if (kind === 'shortcut' && (value === 'enter' || value === 'ctrlEnter')) {
      state.setSendMessageShortcut(value);
    }
  };

  return (
    <>
      <IonHeader>
        <IonToolbar mode="ios">
          <IonButtons slot="start">
            <IonBackButton defaultHref="#setting/global" mode="ios" text="" icon={chevronBack} aria-label="返回全局设置" />
          </IonButtons>
          <IonTitle>{titles[kind]}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="global-settings-choice-content">
        <div className="global-settings-mobile">
          <IonList inset mode="ios">
            <IonRadioGroup value={selected} onIonChange={event => select(event.detail.value)} aria-label={titles[kind]}>
              {options.map(option => (
                <IonItem key={option.value} mode="ios">
                  <IonRadio mode="ios" value={option.value} labelPlacement="start" justify="space-between">
                    <div className="global-settings-choice-label">
                      {'colors' in option && (
                        <span className="global-settings-theme-swatch" aria-hidden="true">
                          {option.colors.map((color, index) => <span key={index} style={{ backgroundColor: color }} />)}
                        </span>
                      )}
                      <div className="global-settings-choice-text">
                        <div className="global-settings-choice-title">{option.label}</div>
                        {option.description && <IonNote>{option.description}</IonNote>}
                      </div>
                    </div>
                  </IonRadio>
                </IonItem>
              ))}
            </IonRadioGroup>
            <IonNote>{kind === 'theme' ? '选择后立即应用，无需保存。' : '选择后立即生效。'}</IonNote>
            {kind === 'assistant' && state.llmConfigs.filter(model => model.enabled).length === 0 && (
              <IonNote>暂无已启用的模型，可在「设置 → 模型」中添加。</IonNote>
            )}
            {!options.some(option => option.value === selected) && (
              <IonNote role="status">原选项已不可用，请重新选择。</IonNote>
            )}
          </IonList>
        </div>
      </IonContent>
    </>
  );
}

export default function GlobalSettingsMobile({ className }: GlobalSettingsProps) {
  const navigation = useContext(SettingsNavigationContext);
  const { state, assistant, assistantLabel } = useGlobalChoices();
  const openChoice = (kind: ChoiceKind) => navigation?.push(
    () => <GlobalChoicePage kind={kind} />, {}, { layout: 'ionic' },
  );
  const row = (kind: ChoiceKind, value: string) => (
    <IonItem button detail mode="ios" onClick={() => openChoice(kind)} aria-label={`${titles[kind]}，${value}`}>
      <IonLabel>{titles[kind]}</IonLabel>
      <IonNote slot="end" className="global-settings-current-value">{value}</IonNote>
    </IonItem>
  );
  return (
    <div className={`global-settings-mobile ${className || ''}`}>
      <IonList inset mode="ios">
        <IonListHeader mode="ios"><IonLabel>显示</IonLabel></IonListHeader>
        <IonItemGroup>{row('display', state.chatStyle === 'document' ? '文档' : '对话')}</IonItemGroup>
      </IonList>
      <IonList inset mode="ios">
        <IonListHeader mode="ios"><IonLabel>对话设置</IonLabel></IonListHeader>
        <IonItemGroup>
          {row('assistant', assistantLabel)}
          {row('role', state.aiRoles.find(role => role.id === state.defaultRoleId)?.name || '不指定默认角色')}
          <IonItem mode="ios">
            <IonToggle mode="ios" color="success" checked={!!assistant?.enabled} justify="space-between" onIonChange={event => {
              state.updateAssistantConfig({ enabled: event.detail.checked });
            }}>自动总结标题</IonToggle>
          </IonItem>
        </IonItemGroup>
        <IonNote>使用辅助模型为新对话生成标题。</IonNote>
      </IonList>
      <IonList inset mode="ios">
        <IonListHeader mode="ios"><IonLabel>外观</IonLabel></IonListHeader>
        <IonItemGroup>{row('theme', themes.find(theme => theme.value === state.theme)?.label || '浮光')}</IonItemGroup>
      </IonList>
      <IonList inset mode="ios">
        <IonListHeader mode="ios"><IonLabel>键盘</IonLabel></IonListHeader>
        <IonItemGroup>{row('shortcut', state.sendMessageShortcut === 'enter' ? 'Return' : shortcutLabel())}</IonItemGroup>
        <IonNote>设置键盘发送消息时使用的快捷键。</IonNote>
      </IonList>
    </div>
  );
}
