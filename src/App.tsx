import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './routes/LoginPage'
import { GruposPage } from './routes/GruposPage'
import { GrupoDetailPage } from './routes/GrupoDetailPage'
import { MembrosPage } from './routes/MembrosPage'
import { RachasPage } from './routes/RachasPage'
import { ConvitePage } from './routes/ConvitePage'
import { CriarRachaPage } from './routes/CriarRachaPage'
import { RachaDetailPage } from './routes/RachaDetailPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/convite/:token" element={<ConvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<GruposPage />} />
        <Route path="/grupos/:grupoId" element={<GrupoDetailPage />} />
        <Route path="/grupos/:grupoId/membros" element={<MembrosPage />} />
        <Route path="/grupos/:grupoId/rachas" element={<RachasPage />} />
        <Route path="/grupos/:grupoId/rachas/novo" element={<CriarRachaPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId" element={<RachaDetailPage />} />
      </Route>
    </Routes>
  )
}

export default App
