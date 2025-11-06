import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { toast } from '../hooks/useToast';
import { Search, Globe, Shield, KeyRound, Activity } from 'lucide-react';

export interface SearchSettingsPageProps {
  onCloseModal?: () => void;
}

const SearchSettingsPage: React.FC<SearchSettingsPageProps> = ({ onCloseModal }) => {
  const { searchConfig, setSearchConfig, updateSearchConfig } = useAppStore();

  const [localConfig, setLocalConfig] = useState(() => ({
    enabled: searchConfig?.enabled ?? false,
    provider: searchConfig?.provider ?? 'google-cse',
    apiKey: searchConfig?.apiKey ?? '',
    engineId: searchConfig?.engineId ?? '',
    language: searchConfig?.language ?? 'zh-CN',
    country: searchConfig?.country ?? 'CN',
    safeSearch: searchConfig?.safeSearch ?? 'off',
    maxResults: searchConfig?.maxResults ?? 5
  }));

  useEffect(() => {
    // 同步 store 改动到本地状态
    if (searchConfig) {
      setLocalConfig((prev) => ({
        ...prev,
        ...searchConfig,
        provider: 'google-cse'
      }));
    }
  }, [searchConfig]);

  const saveConfig = () => {
    try {
      setSearchConfig({
        enabled: !!localConfig.enabled,
        provider: 'google-cse',
        apiKey: localConfig.apiKey?.trim() || undefined,
        engineId: localConfig.engineId?.trim() || undefined,
        language: localConfig.language?.trim() || undefined,
        country: localConfig.country?.trim() || undefined,
        // 仅支持 'off' | 'active'，移除对 'on' 的比较以消除TS错误
        safeSearch: localConfig.safeSearch === 'active' ? 'active' : 'off',
        maxResults: Math.max(1, Math.min(Number(localConfig.maxResults) || 5, 10))
      });
      toast.success('搜索设置已保存');
      if (onCloseModal) onCloseModal();
    } catch (e) {
      console.error('保存搜索设置失败:', e);
      toast.error('保存搜索设置失败');
    }
  };

  const runHealthCheck = async () => {
    const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
    const q = 'site:example.com 测试';
    const params = new URLSearchParams({ q, num: '1' });
    // 若用户提供密钥/engine，传给服务端（否则服务端会用环境变量）
    if (localConfig.apiKey?.trim()) params.set('key', localConfig.apiKey.trim());
    if (localConfig.engineId?.trim()) params.set('cx', localConfig.engineId.trim());

    try {
      const resp = await fetch(`${apiBaseUrl}/api/search?${params.toString()}`, {
        method: 'GET',
        headers: {
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        }
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(`搜索接口不可用：${err?.error || resp.status}`);
        return;
      }
      const data = await resp.json();
      const count = Array.isArray(data?.items) ? data.items.length : 0;
      toast.success(`搜索接口正常，返回 ${count} 条结果`);
    } catch (e) {
      console.error('搜索健康检查失败:', e);
      toast.error('搜索健康检查失败');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto md:pt-0">
      <div className="mb-0">
        <p className="text-base-content/70">配置联网搜索的相关设置</p>
      </div>

      <div className="card mt-4 mb-4">
        <div className="card-body pt-4 md:pt-6 gap-4">
          <h3 className="font-medium text-base mb-2">基础设置</h3>
          <div className="form-control w-full flex">
            <p className="text-base mb-4 hidden md:block">启用联网搜索</p>
            <label className="w-full md:w-1/2 ml-auto flex items-center justify-between">
              <span className="label md:!hidden">启用联网搜索</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={!!localConfig.enabled}
                onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex hero-fieldset">
              <p className="hero-label-md text-base mb-4 hidden md:block">Provider</p>
              <label className="input w-full md:w-1/2 ml-auto">
                <span className="label block md:!hidden">Provider</span>
                <input type="text" className="w-full" value="Google CSE" disabled />
              </label>
            </div>

            <div className="flex hero-fieldset">
              <p className="hero-label-md text-base mb-4 hidden md:block">返回条数（1-10）</p>
              <label className="input w-full md:w-1/2 ml-auto">
                <span className="label block md:!hidden">返回条数（1-10）</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-full"
                  value={localConfig.maxResults}
                  onChange={(e) => setLocalConfig({ ...localConfig, maxResults: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card my-4">
        <div className="card-body pt-4 md:pt-6 gap-4">
          <h3 className="font-medium text-base mb-4">密钥与引擎</h3>

          <div className="flex hero-fieldset">
            <p className="hero-label-md text-base mb-4 hidden md:block">API Key</p>
            <label className="input w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">API Key</span>
              <input
                type="password"
                className="w-full"
                placeholder="用于本地或个人密钥"
                value={localConfig.apiKey}
                onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              />
            </label>
          </div>

          <div className="flex hero-fieldset">
            <p className="hero-label-md text-base mb-4 hidden md:block">Engine ID (cx)</p>
            <label className="input w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">Engine ID (cx)</span>
              <input
                type="text"
                className="w-full"
                placeholder="留空则使用服务端配置"
                value={localConfig.engineId}
                onChange={(e) => setLocalConfig({ ...localConfig, engineId: e.target.value })}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body pt-4 md:pt-6">
          <h3 className="font-medium text-base mb-4">搜索参数</h3>

          <div className="form-control flex hero-fieldset mb-2">
            <p className="hero-label-md text-base mb-4 hidden md:block">语言（hl）</p>
            <label className="input w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">语言（hl）</span>
              <input
                type="text"
                className="w-full"
                placeholder="如 zh-CN"
                value={localConfig.language}
                onChange={(e) => setLocalConfig({ ...localConfig, language: e.target.value })}
              />
            </label>
          </div>

          <div className="form-control flex hero-fieldset mb-2">
            <p className="hero-label-md text-base mb-4 hidden md:block">地域（gl）</p>
            <label className="input w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">地域（gl）</span>
              <input
                type="text"
                className="w-full"
                placeholder="如 CN"
                value={localConfig.country}
                onChange={(e) => setLocalConfig({ ...localConfig, country: e.target.value })}
              />
            </label>
          </div>

          <div className="form-control flex hero-fieldset">
            <p className="hero-label-md text-base mb-4 hidden md:block">安全搜索</p>
            <label className="select w-full md:w-1/2 ml-auto">
              <span className="label block md:!hidden">安全搜索</span>
              <select
                className="select select-bordered w-full"
                value={localConfig.safeSearch}
                onChange={(e) => setLocalConfig({ ...localConfig, safeSearch: e.target.value as 'off' | 'active' })}
              >
                <option value="off">off</option>
                <option value="active">active</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body pt-4 md:pt-6">
          <h3 className="font-medium text-base mb-4">操作</h3>
          <div className="flex items-center gap-3">
            <button className="btn btn-primary btn-base" onClick={saveConfig}>
              保存设置
            </button>
            <button className="btn btn-outline btn-base flex items-center gap-2" onClick={runHealthCheck}>
              <Activity className="h-4 w-4" />
              健康检查
            </button>
            {onCloseModal && (
              <button className="btn btn-ghost btn-base" onClick={onCloseModal}>
                关闭
              </button>
            )}
          </div>
          <div className="text-xs text-base-content/60 mt-3">
            说明：若未在此处输入 API Key / cx，将使用服务端环境变量（更安全）。
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchSettingsPage;