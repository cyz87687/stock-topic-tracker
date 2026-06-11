import { HashRouter, Routes, Route } from 'react-router-dom'
import { useCallback } from 'react'
import { useStore } from '@/store/useStore'
import TabBar from '@/components/TabBar'
import Home from '@/pages/Home'
import TopicDetail from '@/pages/TopicDetail'
import StrengthAnalysis from '@/pages/StrengthAnalysis'
import RotationAnalysisPage from '@/pages/RotationAnalysis'
import LimitBoard from '@/pages/LimitBoard'
import PersonalCenter from '@/pages/PersonalCenter'
import { useNavigate } from 'react-router-dom'

function AppLayout() {
  const navigate = useNavigate()

  const handleTabNavigate = useCallback((path: string) => {
    navigate(path)
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-lg mx-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/topic/:name" element={<TopicDetail />} />
          <Route path="/board" element={<LimitBoard />} />
          <Route path="/analysis" element={<StrengthAnalysis />} />
          <Route path="/rotation" element={<RotationAnalysisPage />} />
          <Route path="/personal" element={<PersonalCenter />} />
        </Routes>
      </div>
      <TabBar onNavigate={handleTabNavigate} />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  )
}
