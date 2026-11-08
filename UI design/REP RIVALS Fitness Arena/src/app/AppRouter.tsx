import { lazy, Suspense } from "react"
import { BrowserRouter, Link, Route, Routes } from "react-router-dom"
import { Home, Dashboard, Battle } from "../features/game/GamePages"
import { AccountPage, AuthForm } from "../features/auth/AccountPages"
import "../features/solo-training/training.css"

const TrainingPage = lazy(
  () => import("../features/solo-training/TrainingPage"),
)

export default function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<p role="status">Loading training…</p>}>
        <Routes>
          <Route path="/register" element={<AuthForm key="register" register />} />
          <Route path="/login" element={<AuthForm key="login" />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/" element={<Home />} />
          <Route path="/arena" element={<Battle />} />
          {['/dashboard','/profile','/progression'].map(path => <Route key={path} path={path} element={<Dashboard />} />)}
          <Route path="/training" element={<TrainingPage />} />
          <Route
            path="*"
            element={
              <main className="training-page">
                <h1>Page not found</h1>
                <Link to="/training">Open camera training</Link>
              </main>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
