import { useNavigate } from 'react-router-dom'
import { Star, ChevronRight, Info, Settings, Bell } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function PersonalCenter() {
  const { favorites, toggleFavorite } = useStore()
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-6 pb-4 space-y-4 tab-bar-safe-area">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-up/80 to-orange-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-up/20">
          T
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">题材追踪者</h2>
          <p className="text-xs text-slate-400 mt-0.5">关注市场热点，把握轮动节奏</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-up">{favorites.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">关注题材</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-medium">-</div>
          <div className="text-[10px] text-slate-400 mt-0.5">今日提醒</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-neutral">-</div>
          <div className="text-[10px] text-slate-400 mt-0.5">历史记录</div>
        </div>
      </div>

      <div className="card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Star size={14} className="text-yellow-400" />
            我的关注
          </h3>
          {favorites.length > 0 && (
            <span className="text-[10px] text-slate-500">{favorites.length}个题材</span>
          )}
        </div>

        {favorites.length === 0 ? (
          <div className="py-8 text-center">
            <Star size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-xs text-slate-500">暂无关注题材</p>
            <p className="text-[10px] text-slate-600 mt-1">在题材详情页点击星标即可关注</p>
          </div>
        ) : (
          <div className="space-y-1">
            {favorites.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-bg-hover/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/topic/${encodeURIComponent(name)}`)}
              >
                <span className="text-sm text-white">{name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(name)
                    }}
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    <Star size={14} fill="currentColor" />
                  </button>
                  <ChevronRight size={14} className="text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <button className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-bg-hover/30 transition-colors">
          <Bell size={16} className="text-slate-400" />
          <span className="text-sm text-slate-300 flex-1 text-left">消息通知</span>
          <ChevronRight size={14} className="text-slate-600" />
        </button>
        <div className="border-t border-slate-700/50" />
        <button className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-bg-hover/30 transition-colors">
          <Settings size={16} className="text-slate-400" />
          <span className="text-sm text-slate-300 flex-1 text-left">设置</span>
          <ChevronRight size={14} className="text-slate-600" />
        </button>
        <div className="border-t border-slate-700/50" />
        <button className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-bg-hover/30 transition-colors">
          <Info size={16} className="text-slate-400" />
          <span className="text-sm text-slate-300 flex-1 text-left">关于</span>
          <ChevronRight size={14} className="text-slate-600" />
        </button>
      </div>

      <div className="text-center pt-2">
        <p className="text-[10px] text-slate-600">题材轮动追踪 v1.0.0</p>
      </div>
    </div>
  )
}
