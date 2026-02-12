import {
  BellRing,
  Flag,
  Gauge,
  ListChecks,
  MessageSquareWarning,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserRound,
  Users,
  VolumeX,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { getCurrentUser } from '@/hooks/useUsers'
import { cn } from '@/lib/utils'

interface AdminNavItem {
  label: string
  path: string
  icon: ComponentType<{ className?: string }>
}

const adminNavItems: AdminNavItem[] = [
  { label: 'Overview', path: '/admin', icon: Gauge },
  { label: 'Reports', path: '/admin/reports', icon: Flag },
  { label: 'Reported Posts', path: '/admin/reports/posts', icon: ListChecks },
  {
    label: 'Reported Messages',
    path: '/admin/reports/messages',
    icon: MessageSquareWarning,
  },
  { label: 'Reported Users', path: '/admin/reports/users', icon: UserRound },
  { label: 'Ban Requests', path: '/admin/ban-requests', icon: ShieldAlert },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'User Lists', path: '/admin/user-lists', icon: ListChecks },
  { label: 'User Info', path: '/admin/user-info', icon: User },
  { label: 'Room Mutes', path: '/admin/room-mutes', icon: VolumeX },
  {
    label: 'Sanctum Requests',
    path: '/admin/sanctum-requests',
    icon: ShieldCheck,
  },
  {
    label: 'Feature Flags',
    path: '/admin/feature-flags',
    icon: BellRing,
  },
]

export default function AdminLayout() {
  const currentUser = getCurrentUser()
  const location = useLocation()

  if (!currentUser?.is_admin) {
    return <Navigate to='/sanctums' replace />
  }

  return (
    <div className='flex h-full min-h-0 flex-1 overflow-hidden bg-background'>
      <aside className='hidden w-72 shrink-0 border-r border-border/70 bg-card/45 md:flex md:flex-col'>
        <div className='border-b border-border/70 px-4 py-3'>
          <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
            Admin Console
          </p>
          <p className='mt-1 text-sm font-semibold text-foreground'>
            Moderation + Operations
          </p>
        </div>

        <nav className='min-h-0 flex-1 overflow-y-auto px-2 py-3'>
          <div className='space-y-1'>
            {adminNavItems.map(item => {
              const active =
                item.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <item.icon className='h-4 w-4 shrink-0' />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </aside>

      <main className='min-h-0 flex-1 overflow-auto'>
        <div className='mx-auto max-w-7xl px-4 py-5 md:px-6'>
          <div className='mb-4 flex items-center gap-2 text-xs text-muted-foreground'>
            <Shield className='h-3.5 w-3.5' />
            <span>Admin</span>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
