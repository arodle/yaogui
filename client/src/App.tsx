import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { Medicines } from './pages/Medicines'
import { AddMedicine } from './pages/AddMedicine'
import { CategoryManagement } from './pages/CategoryManagement'
import { BillImport } from './pages/BillImport'
import { Records } from './pages/Records'
import { Reminders } from './pages/Reminders'
import { Profile } from './pages/Profile'
import { FamilySharing } from './pages/FamilySharing'
import { useAuthStore } from './context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  return isAuthenticated ? <Navigate to="/" /> : <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/medicines" element={<Medicines />} />
          <Route path="/medicines/add" element={<AddMedicine />} />
          <Route path="/medicines/categories" element={<CategoryManagement />} />
          <Route path="/medicines/:id" element={<AddMedicine />} />
          <Route path="/records" element={<Records />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/family" element={<FamilySharing />} />
          <Route path="/bill-import" element={<BillImport />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
