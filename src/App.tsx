import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './routes/LoginPage'
import { GruposPage } from './routes/GruposPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<GruposPage />} />
      </Route>
    </Routes>
  )
}

export default App
