import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './routes/LoginPage'
import { GruposPage } from './routes/GruposPage'
import { GrupoDetailPage } from './routes/GrupoDetailPage'
import { ConvitePage } from './routes/ConvitePage'
import { ProtectedRoute } from './routes/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/convite/:token" element={<ConvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<GruposPage />} />
        <Route path="/grupos/:grupoId" element={<GrupoDetailPage />} />
      </Route>
    </Routes>
  )
}

export default App
