import { Activity, AlertTriangle, Users } from 'lucide-react'
import {
  useAdminBanRequests,
  useAdminReports,
  useAdminUsers,
} from '@/hooks/useAdminModeration'

export default function AdminOverview() {
  const { data: openReports = [] } = useAdminReports({
    status: 'open',
    limit: 200,
  })
  const { data: banRequests = [] } = useAdminBanRequests({ limit: 200 })
  const { data: users = [] } = useAdminUsers({ limit: 1 })

  const cards = [
    {
      title: 'Open Reports',
      value: openReports.length,
      icon: AlertTriangle,
      tone: 'text-amber-500',
    },
    {
      title: 'Ban Requests',
      value: banRequests.length,
      icon: Activity,
      tone: 'text-destructive',
    },
    {
      title: 'Users (sample loaded)',
      value: users.length,
      icon: Users,
      tone: 'text-primary',
    },
  ]

  return (
    <div className='space-y-4'>
      <header>
        <h1 className='text-2xl font-bold'>Overview</h1>
        <p className='text-sm text-muted-foreground'>
          Global moderation and account-state snapshot.
        </p>
      </header>

      <div className='grid gap-3 md:grid-cols-3'>
        {cards.map(card => (
          <article
            key={card.title}
            className='rounded-xl border border-border/70 bg-card/60 p-4'
          >
            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>{card.title}</p>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <p className='mt-2 text-3xl font-bold'>{card.value}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
