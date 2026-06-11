import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Pill } from 'lucide-react'
import { api } from '../api'
import { useAuthStore } from '../context/AuthContext'

export function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await api.auth.login(email, password)
      setAuth(data.user, data.token)
      navigate('/')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = async () => {
    setError('')
    setLoading(true)
    try {
      api.enableDemo()
      const data = await api.auth.login('demo@medicine.cab', 'demo123')
      setAuth(data.user, data.token)
      api.seedDemoIfEmpty()
      navigate('/')
    } catch (err: any) {
      setError(err.message || '演示模式启动失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Pill className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-text">电子药箱</h1>
          <p className="text-gray-400 mt-1">管理您的健康用药</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-500 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="请输入邮箱"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-12"
                placeholder="请输入密码"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">或</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full px-6 py-3 rounded-xl font-medium bg-secondary text-white hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            一键进入演示模式（无需账号）
          </button>

          <p className="text-center text-gray-500 text-sm">
            还没有账号？{' '}
            <Link to="/register" className="text-primary font-medium">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
