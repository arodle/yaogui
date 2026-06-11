import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Pill, Calendar, Bell, User, LogOut } from 'lucide-react'
import { useAuthStore } from '../context/AuthContext'

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/medicines', icon: Pill, label: '药品库' },
  { path: '/records', icon: Calendar, label: '记录' },
  { path: '/reminders', icon: Bell, label: '提醒' },
  { path: '/profile', icon: User, label: '我的' }
]

export function Layout() {
  const location = useLocation()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex">
      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 p-4">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-text">电子药箱</h1>
            <p className="text-xs text-gray-400">健康管理</p>
          </div>
        </div>

        <nav className="flex-1 mt-4">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">退出登录</span>
        </button>
      </aside>

      {/* 移动端底部导航 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 z-50">
        <div className="flex justify-around">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 lg:p-8 p-4 pb-20 lg:pb-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
