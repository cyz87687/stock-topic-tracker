import { Home, BarChart3, GitBranch, User, Flame } from 'lucide-react'
import { useStore } from '@/store/useStore'
import clsx from 'clsx'

const tabs = [
  { key: 'home' as const, label: '题材榜', icon: Home, path: '/' },
  { key: 'board' as const, label: '连板榜', icon: Flame, path: '/board' },
  { key: 'analysis' as const, label: '强弱分析', icon: BarChart3, path: '/analysis' },
  { key: 'rotation' as const, label: '轮动分析', icon: GitBranch, path: '/rotation' },
  { key: 'personal' as const, label: '我的', icon: User, path: '/personal' },
]

interface TabBarProps {
  onNavigate: (path: string) => void
}

export default function TabBar({ onNavigate }: TabBarProps) {
  const currentTab = useStore((s) => s.currentTab)
  const setTab = useStore((s) => s.setTab)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-card/95 backdrop-blur-lg border-t border-slate-700/50">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = currentTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => {
                setTab(tab.key)
                onNavigate(tab.path)
              }}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors duration-200',
                active ? 'text-up' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <tab.icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className={clsx('text-[10px]', active && 'font-semibold')}>{tab.label}</span>
            </button>
          )
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  )
}
