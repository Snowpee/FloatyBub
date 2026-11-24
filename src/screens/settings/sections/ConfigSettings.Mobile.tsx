import { useContext, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput,
  IonItem, IonItemGroup, IonLabel, IonList, IonListHeader, IonNote, IonRadio,
  IonRadioGroup, IonSearchbar, IonSpinner, IonTitle, IonToggle, IonToolbar, useIonAlert,
} from '@ionic/react';
import { add, chevronBack } from 'ionicons/icons';
import { useAppStore } from '@/store';
import { SettingsNavigationContext } from '../SettingsNavigationContext';
import { changeModelProvider, createModelDraft, modelDraftConfig, modelProviders, validateModelDraft, type ModelDraft, type ModelDraftSession } from './modelDraft';
import { modelConnectionError, runModelRequest, supportsModelDiscovery } from './modelConnection';
import './model-settings-mobile.css';

type EditorProps = { session: ModelDraftSession };
type ChoiceKind = 'provider' | 'model' | 'thinking' | 'effort';
const useDraft = (session: ModelDraftSession) => useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
function useNavigation() {
  const navigation = useContext(SettingsNavigationContext);
  if (!navigation) throw new Error('Mobile model settings require settings navigation');
  return navigation;
}
function useQuestion() {
  const [present] = useIonAlert();
  return (header: string, message: string, action: string) => new Promise<boolean>(resolve => {
    let accepted = false;
    void present({ header, message, buttons: [
      { text: '取消', role: 'cancel' },
      { text: action, role: 'destructive', handler: () => { accepted = true; } },
    ], onDidDismiss: () => resolve(accepted) });
  });
}
function Page({ title, children, action, back, onBackCapture }: { title: string; children: ReactNode; action?: ReactNode; back?: ReactNode; onBackCapture?: (event: MouseEvent) => void }) {
  return <>
    <IonHeader><IonToolbar mode="ios">
      <IonButtons slot="start" onClickCapture={onBackCapture}>{back ?? <IonBackButton mode="ios" text="" icon={chevronBack} defaultHref="#setting/config" aria-label="返回模型配置" />}</IonButtons>
      <IonTitle>{title}</IonTitle>
      {action && <IonButtons slot="end">{action}</IonButtons>}
    </IonToolbar></IonHeader>
    <IonContent><div className="model-settings-mobile">{children}</div></IonContent>
  </>;
}
function Group({ title, children, note }: { title?: string; children: ReactNode; note?: ReactNode }) {
  return <IonList inset mode="ios">
    {title && <IonListHeader mode="ios"><IonLabel>{title}</IonLabel></IonListHeader>}
    <IonItemGroup>{children}</IonItemGroup>
    {note && <IonNote>{note}</IonNote>}
  </IonList>;
}
function ValueRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return <IonItem mode="ios" button detail onClick={onClick} aria-label={`${label}，${value}`}>
    <IonLabel>{label}</IonLabel><IonNote slot="end" className="model-settings-value">{value}</IonNote>
  </IonItem>;
}
function Field({ session, field, label, type = 'text', error, placeholder }: {
  session: ModelDraftSession; field: keyof ModelDraft; label: string;
  type?: 'text' | 'password' | 'url' | 'number'; error?: string; placeholder?: string;
}) {
  const draft = useDraft(session);
  const [touched, setTouched] = useState(false);
  return <IonItem mode="ios"><IonInput label={label} labelPlacement="start" type={type}
    value={String(draft[field] ?? '')} placeholder={placeholder}
    inputmode={type === 'url' ? 'url' : type === 'number' ? (field === 'maxTokens' ? 'numeric' : 'decimal') : 'text'}
    autocapitalize="off" autocorrect={false} spellcheck={false}
    className={`model-settings-input${touched && error ? ' ion-invalid ion-touched' : ''}`} errorText={touched ? error : undefined}
    onIonBlur={() => setTouched(true)}
    onIonInput={event => session.patch({ [field]: event.detail.value ?? '' })} />
  </IonItem>;
}

// Abort superseded/unmounted requests and ignore late results from old credentials.
function useModelOperation(draft: ModelDraft, discover: boolean) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const fingerprint = JSON.stringify([draft.provider, draft.apiKey, draft.baseUrl, draft.proxyUrl, discover ? '' : draft.model,
    draft.deepseekThinkingMode, draft.deepseekReasoningEffort]);
  useEffect(() => {
    generation.current++;
    request.current?.abort();
    request.current = null;
    setStatus('idle'); setMessage(''); setModels([]);
    const counter = generation;
    return () => { counter.current++; request.current?.abort(); };
  }, [fingerprint]);
  const run = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    const timer = setTimeout(() => controller.abort(), 10000);
    setStatus('pending'); setMessage('');
    try {
      const result = await runModelRequest(modelDraftConfig(draft), discover, controller.signal);
      if (generation.current !== current) return;
      setModels(result); setStatus('success');
      setMessage(discover ? result.length ? `获取到 ${result.length} 个模型` : '服务未返回可用模型，可手动输入模型 ID。' : '连接成功，服务已接受此模型的测试请求。');
    } catch (error) {
      if (generation.current !== current) return;
      setStatus('error'); setMessage(modelConnectionError(error));
    } finally {
      clearTimeout(timer);
      if (request.current === controller) request.current = null;
    }
  };
  return { status, message, models, run };
}

export default function ConfigSettingsMobile() {
  const navigation = useNavigation();
  const configs = useAppStore(state => state.llmConfigs);
  const open = (id?: string) => {
    const config = configs.find(item => item.id === id);
    const session = createModelDraft(config);
    navigation.push(() => <ModelEditorPage session={session} />, {}, { layout: 'ionic' });
  };
  return <Page title="模型"
    back={<IonBackButton mode="ios" text="" icon={chevronBack} defaultHref="#setting" aria-label="返回设置" />}
    action={<IonButton onClick={() => open()} aria-label="添加模型"><IonIcon slot="icon-only" icon={add} /></IonButton>}>
    {configs.length ? <Group note="点按配置进行编辑。启用的配置可在聊天中选择。">
      {configs.map(config => <IonItem key={config.id} mode="ios" button detail onClick={() => open(config.id)} aria-label={`编辑模型 ${config.name}`}>
        <IonLabel className="model-settings-summary"><h2>{config.name}</h2>
          <p>{modelProviders.find(p => p.value === config.provider)?.label} · {config.model}</p>
        </IonLabel><IonNote slot="end">{config.enabled ? '已启用' : '未启用'}</IonNote>
      </IonItem>)}
    </Group> : <div className="model-settings-empty">
      <h2>尚未添加模型</h2><p>添加服务连接后，即可选择模型开始对话。</p>
      <IonButton onClick={() => open()}>添加模型</IonButton>
    </div>}
  </Page>;
}

export function ModelEditorPage({ session }: EditorProps) {
  const draft = useDraft(session);
  const navigation = useNavigation();
  const store = useAppStore();
  const ask = useQuestion();
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const operation = useModelOperation(draft, false);
  const errors = validateModelDraft(draft);
  const valid = Object.keys(errors).length === 0;
  const dirty = session.isDirty();
  // A dirty form can't be silently dismissed by a modal gesture or edge swipe.
  // The explicit back button presents the same discard choice as modal dismissal.
  const confirmDiscard = useRef<() => Promise<boolean>>(async () => true);
  confirmDiscard.current = () => ask('放弃修改？', '尚未保存的模型配置将被丢弃。', '放弃修改');
  useEffect(() => {
    navigation.setBackNavigationGuard?.(saving || deleting ? async () => false : dirty ? () => confirmDiscard.current() : null);
    return () => navigation.setBackNavigationGuard?.(null);
  }, [dirty, saving, deleting, navigation]);
  const open = (kind: ChoiceKind) => navigation.push(() => <ModelChoicePage session={session} kind={kind} />, {}, { layout: 'ionic' });
  const save = () => {
    if (!valid || savingRef.current || deleting) return;
    if (session.id && !store.llmConfigs.some(item => item.id === session.id)) { setError('此配置已被删除，请返回模型列表。'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      const config = modelDraftConfig(draft);
      if (session.id) store.updateLLMConfig(session.id, config); else store.addLLMConfig(config);
      navigation.pop();
    } catch { setError('保存失败，请重试。'); savingRef.current = false; setSaving(false); }
  };
  const remove = async () => {
    if (!session.id || deleting || savingRef.current) return;
    if (!await ask('删除模型配置？', '此配置将从模型列表移除，已有聊天记录会保留。此操作不可撤销。', '删除配置') || !mounted.current) return;
    setDeleting(true); setError('');
    try { await store.deleteLLMConfig(session.id); if (mounted.current) navigation.pop(); }
    catch { if (!mounted.current) return; setError('删除失败，配置已保留，请稍后重试。'); setDeleting(false); }
  };
  return <Page title={session.id ? '编辑模型' : '添加模型'}
    back={<IonBackButton mode="ios" text="" icon={chevronBack} defaultHref="#setting/config" aria-label="返回模型列表"
      disabled={deleting || saving}
    />}
    onBackCapture={event => {
      if (!dirty) return;
      event.preventDefault(); event.stopPropagation();
      void confirmDiscard.current().then(confirmed => { if (confirmed) navigation.pop(); });
    }}
    action={<IonButton onClick={save} disabled={!valid || saving || deleting} aria-label="保存模型">{saving ? <IonSpinner /> : '保存'}</IonButton>}>
    <Group title="基本信息" note="带“必填”的项目需要填写。所有修改在保存后生效。">
      <Field session={session} field="name" label="名称（必填）" error={errors.name} placeholder="为此连接起个名字" />
      <ValueRow label="提供商" value={modelProviders.find(p => p.value === draft.provider)?.label ?? draft.provider} onClick={() => open('provider')} />
      <ValueRow label="模型" value={draft.model || '请选择（必填）'} onClick={() => open('model')} />
      <IonItem mode="ios"><IonToggle mode="ios" color="success" checked={draft.enabled} justify="space-between" onIonChange={e => session.patch({ enabled: e.detail.checked })}>启用此配置</IonToggle></IonItem>
    </Group>
    <Group title="连接设置" note="测试会向当前服务发送一条简短消息，可能产生少量调用费用。">
      <Field session={session} field="apiKey" label="API 密钥（必填）" type={showKey ? 'text' : 'password'} error={errors.apiKey} />
      <IonItem mode="ios" button detail={false} onClick={() => setShowKey(value => !value)} aria-label={showKey ? '隐藏密钥' : '显示密钥'}><IonLabel>{showKey ? '隐藏密钥' : '显示密钥'}</IonLabel></IonItem>
      <ValueRow label="服务地址" value={errors.baseUrl || errors.proxyUrl || (draft.proxyUrl ? '使用代理地址' : draft.baseUrl || '使用默认地址')} onClick={() => navigation.push(() => <ModelConnectionPage session={session} />, {}, { layout: 'ionic' })} />
      <IonItem mode="ios" button detail={false} disabled={!valid || operation.status === 'pending' || deleting} onClick={operation.run} aria-label="测试连接">
        <IonLabel>{operation.status === 'pending' ? '正在测试连接…' : '测试连接'}</IonLabel>{operation.status === 'pending' && <IonSpinner slot="end" />}
      </IonItem>
      {operation.message && <IonItem mode="ios"><IonLabel className="ion-text-wrap" role="status">{operation.message}</IonLabel></IonItem>}
    </Group>
    <Group>
      <ValueRow label="生成参数" value={errors.temperature || errors.maxTokens || `温度 ${draft.temperature} · 输出上限 ${draft.maxTokens}`} onClick={() => navigation.push(() => <ModelParametersPage session={session} />, {}, { layout: 'ionic' })} />
    </Group>
    {error && <p className="model-settings-error" role="alert">{error}</p>}
    {session.id && <Group><IonItem mode="ios" button detail={false} color="danger" disabled={deleting || saving} onClick={remove} aria-label="删除模型配置"><IonLabel>{deleting ? '正在删除…' : '删除此配置'}</IonLabel></IonItem></Group>}
  </Page>;
}

export function ModelChoicePage({ session, kind }: EditorProps & { kind: ChoiceKind }) {
  const draft = useDraft(session);
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState(draft.model);
  const [showManual, setShowManual] = useState(false);
  const operation = useModelOperation(draft, true);
  const navigation = useNavigation();
  const options = kind === 'provider' ? modelProviders : kind === 'thinking' ? [
    { value: 'default', label: '跟随模型默认' }, { value: 'enabled', label: '开启' }, { value: 'disabled', label: '关闭' },
  ] : kind === 'effort' ? [{ value: 'high', label: '高（high）' }, { value: 'max', label: '最大（max）' }]
    : [...new Set([draft.model, ...operation.models].filter(Boolean))].map(value => ({ value, label: value }));
  const selected = kind === 'provider' ? draft.provider : kind === 'thinking' ? draft.deepseekThinkingMode : kind === 'effort' ? draft.deepseekReasoningEffort : draft.model;
  const choose = (value: unknown) => {
    if (typeof value !== 'string' || !options.some(option => option.value === value)) return;
    if (kind === 'provider') changeModelProvider(session, value as ModelDraft['provider']);
    else if (kind === 'thinking') session.patch({ deepseekThinkingMode: value as ModelDraft['deepseekThinkingMode'] });
    else if (kind === 'effort') session.patch({ deepseekReasoningEffort: value as ModelDraft['deepseekReasoningEffort'] });
    else session.patch({ model: value });
    navigation.pop();
  };
  return <Page title={{ provider: '提供商', model: '选择模型', thinking: '思考模式', effort: '思考强度' }[kind]}>
    {kind === 'model' && <IonSearchbar mode="ios" placeholder="搜索模型 ID" value={search} onIonInput={e => setSearch(e.detail.value ?? '')} />}
    <IonList inset mode="ios"><IonRadioGroup value={selected} onIonChange={e => choose(e.detail.value)}>
      {options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())).map(option => <IonItem mode="ios" key={option.value}>
        <IonRadio mode="ios" value={option.value} labelPlacement="start" justify="space-between">{option.label}</IonRadio>
      </IonItem>)}
    </IonRadioGroup>
      {options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())).length === 0 && <IonNote>{search ? '没有匹配的模型，可尝试手动输入。' : '获取可用模型，或手动输入模型 ID。'}</IonNote>}
    </IonList>
    {kind === 'model' && <>
      <Group note={operation.message || (!supportsModelDiscovery(draft.provider) ? '此提供商请手动输入模型 ID。' : '填写密钥和服务地址后，可获取当前账户的模型。')}>
        {supportsModelDiscovery(draft.provider) && <IonItem mode="ios" button detail={false} onClick={operation.run} disabled={operation.status === 'pending' || !draft.apiKey.trim() || !!validateModelDraft(draft).baseUrl || !!validateModelDraft(draft).proxyUrl} aria-label="获取模型列表"><IonLabel>{operation.status === 'pending' ? '正在获取…' : '刷新模型列表'}</IonLabel>{operation.status === 'pending' && <IonSpinner slot="end" />}</IonItem>}
        <IonItem mode="ios" button detail={false} onClick={() => setShowManual(value => !value)} aria-label="手动输入模型 ID"><IonLabel>手动输入模型 ID</IonLabel></IonItem>
      </Group>
      {showManual && <Group note="填写服务商提供的完整模型 ID。">
        <IonItem mode="ios"><IonInput className="model-settings-input" label="模型 ID" labelPlacement="start" value={manual} autocapitalize="off" autocorrect={false} spellcheck={false} onIonInput={e => setManual(e.detail.value ?? '')} /></IonItem>
        <IonItem mode="ios" button detail={false} disabled={!manual.trim()} onClick={() => { session.patch({ model: manual.trim() }); navigation.pop(); }} aria-label="使用此模型"><IonLabel>使用此模型</IonLabel></IonItem>
      </Group>}
    </>}
  </Page>;
}
export function ModelConnectionPage({ session }: EditorProps) {
  const draft = useDraft(session);
  const errors = validateModelDraft(draft);
  return <Page title="服务地址"><Group title="连接地址" note="留空使用提供商默认地址。支持根地址或以 /v1 结尾的地址；填写代理地址后，请求优先通过代理发送。">
    <Field session={session} field="baseUrl" label="基础 URL" type="url" error={errors.baseUrl} placeholder="https://api.example.com" />
    <Field session={session} field="proxyUrl" label="代理 URL" type="url" error={errors.proxyUrl} placeholder="选填" />
  </Group></Page>;
}
export function ModelParametersPage({ session }: EditorProps) {
  const draft = useDraft(session);
  const errors = validateModelDraft(draft);
  const navigation = useNavigation();
  const open = (kind: ChoiceKind) => navigation.push(() => <ModelChoicePage session={session} kind={kind} />, {}, { layout: 'ionic' });
  return <Page title="生成参数"><Group title="回复生成" note="参数支持范围以服务商和所选模型为准。">
    <Field session={session} field="temperature" label="温度（0～2）" type="number" error={errors.temperature} />
    <Field session={session} field="maxTokens" label="最大输出令牌" type="number" error={errors.maxTokens} />
  </Group>{draft.provider === 'deepseek' && <Group title="思考设置">
    <ValueRow label="思考模式" value={{ default: '跟随模型默认', enabled: '开启', disabled: '关闭' }[draft.deepseekThinkingMode ?? 'default']} onClick={() => open('thinking')} />
    {draft.deepseekThinkingMode !== 'disabled' && <ValueRow label="思考强度" value={draft.deepseekReasoningEffort ?? 'high'} onClick={() => open('effort')} />}
  </Group>}</Page>;
}
