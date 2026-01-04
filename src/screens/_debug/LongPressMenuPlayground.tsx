import React, { useState } from 'react'
import LongPressMenu from '@/components/LongPressMenu'
import { Pin, Edit3, EyeOff, Trash2, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const ItemCard: React.FC<{ title: string }> = ({ title }) => (
  <div className={cn('flex items-center justify-between h-12 px-3 rounded-md bg-base-200 active:bg-base-300')}>
    <div className="flex items-center gap-2">
      <div className="avatar"><div className="rounded-full w-8 bg-base-300" /></div>
      <span className="text-sm text-base-content truncate">{title}</span>
    </div>
    <Menu className="h-4 w-4 opacity-60" />
  </div>
)

const LongPressMenuPlayground: React.FC = () => {
  const [log, setLog] = useState<string>('')
  const push = (m: string) => setLog(prev => `${new Date().toLocaleTimeString()} ${m}\n` + prev)

  const menuItems = [
    { key: 'pin', label: '置顶', icon: <Pin className="h-4 w-4" />, onClick: () => push('置顶') },
    { key: 'rename', label: '重命名', icon: <Edit3 className="h-4 w-4" />, onClick: () => push('重命名') },
    { key: 'hide', label: '隐藏对话', icon: <EyeOff className="h-4 w-4" />, onClick: () => push('隐藏对话') },
    { key: 'trash', label: '移至回收站', icon: <Trash2 className="h-4 w-4 text-error" />, onClick: () => push('移至回收站') },
  ]

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">LongPressMenu Playground</h1>
      <p className="text-sm text-base-content/60">在 iOS/Capacitor 环境下，长按下列条目以打开菜单；Web/H5 不会生效。</p>

      <div className="space-y-2 flex flex-col">
        {[
          '杭州今日天气',
          '初次问候',
          '阿里妈妈 AIGC 招聘',
          '旅行计划',
          '周报生成助手'
        ].map((t, i) => (
          <LongPressMenu key={i} items={menuItems}>
            <ItemCard title={t} />
          </LongPressMenu>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold mt-4">日志</h2>
        <pre className="bg-base-200 p-2 rounded-md text-xs whitespace-pre-wrap">{log}</pre>
      </div>
    </div>
  )
}

export default LongPressMenuPlayground