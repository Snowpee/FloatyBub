import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../../store';
import { toast } from '../../../hooks/useToast';
import { Activity } from 'lucide-react';
import { getApiBaseUrl, cn } from '../../../lib/utils';

export interface SearchSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

const SearchSettings: React.FC<SearchSettingsProps> = ({ onCloseModal, className }) => {
  const { searchConfig, setSearchConfig } = useAppStore();

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
        // 仅支持 'off' | 'active'
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
    const apiBaseUrl = getApiBaseUrl();
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
    <div className={cn("p-4 md:p-6 max-w-4xl mx-auto md:pt-0", className)}>

      <div className="flex flex-col gap-6">
        {/* 基础设置 */}
        <div>
          <fieldset className='bub-fieldset'>
            {/* 启用开关 */}
            <div className="bub-checkbox h-12 flex items-center justify-between pr-0">
              <span className="label">启用联网搜索</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={!!localConfig.enabled}
                onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
              />
            </div>

            {/* Provider */}
            <div>
              <label className='bub-input'>
                <span className="label">Provider</span>
                <input
                  type="text"
                  value="Google CSE"
                  disabled
                  className="text-base-content/50"
                />
              </label>
            </div>

            {/* 返回条数 */}
            <div>
              <label className='bub-input'>
                <span className="label">返回条数 (1-10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={localConfig.maxResults}
                  onChange={(e) => setLocalConfig({ ...localConfig, maxResults: Number(e.target.value) })}
                />
              </label>
            </div>
          </fieldset>
        </div>

        {/* 密钥与引擎 */}
        <div>
          <h3 className="text-sm font-medium text-base-content/50 mb-2 pl-[calc(1rem+1px)]">密钥与引擎</h3>
          <fieldset className='bub-fieldset'>
            <div>
              <label className='bub-input'>
                <span className="label">API Key</span>
                <input
                  type="password"
                  placeholder="用于本地或个人密钥"
                  value={localConfig.apiKey}
                  onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                />
              </label>
            </div>
            <div>
              <label className='bub-input'>
                <span className="label">Engine ID (cx)</span>
                <input
                  type="text"
                  placeholder="留空则使用服务端配置"
                  value={localConfig.engineId}
                  onChange={(e) => setLocalConfig({ ...localConfig, engineId: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          <div className="text-sm text-base-content/40 py-2 pl-[calc(1rem+1px)]">
            说明：若未在此处输入 API Key / cx，将使用服务端环境变量（更安全）。
          </div>
        </div>

        {/* 搜索参数 */}
        <div>
          <h3 className="text-sm font-medium text-base-content/50 mb-2 pl-[calc(1rem+1px)]">搜索参数</h3>
          <fieldset className='bub-fieldset'>
            <div>
              <label className='bub-input'>
                <span className="label">语言 (hl)</span>
                <input
                  type="text"
                  placeholder="如 zh-CN"
                  value={localConfig.language}
                  onChange={(e) => setLocalConfig({ ...localConfig, language: e.target.value })}
                />
              </label>
            </div>
            <div>
              <label className='bub-input'>
                <span className="label">地域 (gl)</span>
                <input
                  type="text"
                  placeholder="如 CN"
                  value={localConfig.country}
                  onChange={(e) => setLocalConfig({ ...localConfig, country: e.target.value })}
                />
              </label>
            </div>
            <div>
              <label className='bub-select'>
                <span className="label">安全搜索</span>
                <select
                  value={localConfig.safeSearch}
                  onChange={(e) => setLocalConfig({ ...localConfig, safeSearch: e.target.value as 'off' | 'active' })}
                >
                  <option value="off">off</option>
                  <option value="active">active</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>

        {/* 操作 */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
          <button className="btn btn-primary w-full sm:w-auto" onClick={saveConfig}>
            保存设置
          </button>
          <button className="btn btn-outline w-full sm:w-auto" onClick={runHealthCheck}>
            <Activity className="h-4 w-4 mr-2" />
            健康检查
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchSettings;
