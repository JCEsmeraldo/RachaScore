import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './routes/LoginPage'
import { GruposPage } from './routes/GruposPage'
import { GrupoDetailPage } from './routes/GrupoDetailPage'
import { MembrosPage } from './routes/MembrosPage'
import { RachasPage } from './routes/RachasPage'
import { ConvitePage } from './routes/ConvitePage'
import { CriarRachaPage } from './routes/CriarRachaPage'
import { EditarRachaPage } from './routes/EditarRachaPage'
import { RachaDetailPage } from './routes/RachaDetailPage'
import { PresencaPage } from './routes/PresencaPage'
import { TimesPage } from './routes/TimesPage'
import { PartidasPage } from './routes/PartidasPage'
import { CriarPartidaPage } from './routes/CriarPartidaPage'
import { PartidaDetailPage } from './routes/PartidaDetailPage'
import { AvaliarPage } from './routes/AvaliarPage'
import { EstatisticasRachaPage } from './routes/EstatisticasRachaPage'
import { EstatisticasGrupoPage } from './routes/EstatisticasGrupoPage'
import { JogadorDetailPage } from './routes/JogadorDetailPage'
import { InstalarPage } from './routes/InstalarPage'
import { AssumirPerfilPage } from './routes/AssumirPerfilPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/convite/:token" element={<ConvitePage />} />
      <Route path="/assumir/:token" element={<AssumirPerfilPage />} />
      <Route path="/instalar" element={<InstalarPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<GruposPage />} />
        <Route path="/grupos/:grupoId" element={<GrupoDetailPage />} />
        <Route path="/grupos/:grupoId/membros" element={<MembrosPage />} />
        <Route path="/grupos/:grupoId/jogadores/:jogadorId" element={<JogadorDetailPage />} />
        <Route path="/grupos/:grupoId/estatisticas" element={<EstatisticasGrupoPage />} />
        <Route path="/grupos/:grupoId/rachas" element={<RachasPage />} />
        <Route path="/grupos/:grupoId/rachas/novo" element={<CriarRachaPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId" element={<RachaDetailPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId/editar" element={<EditarRachaPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId/presenca" element={<PresencaPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId/times" element={<TimesPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId/partidas" element={<PartidasPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId/avaliar" element={<AvaliarPage />} />
        <Route path="/grupos/:grupoId/rachas/:rachaId/partidas/nova" element={<CriarPartidaPage />} />
        <Route
          path="/grupos/:grupoId/rachas/:rachaId/partidas/:partidaId"
          element={<PartidaDetailPage />}
        />
        <Route
          path="/grupos/:grupoId/rachas/:rachaId/estatisticas"
          element={<EstatisticasRachaPage />}
        />
      </Route>
    </Routes>
  )
}

export default App
