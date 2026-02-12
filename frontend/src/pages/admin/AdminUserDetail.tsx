import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useAdminUserDetail,
  useBanAdminUser,
  useUnbanAdminUser,
} from '@/hooks/useAdminModeration'

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id || 0)
  const [banReason, setBanReason] = useState('')

  const { data, isLoading, isError, refetch } = useAdminUserDetail(userId)
  const banUser = useBanAdminUser()
  const unbanUser = useUnbanAdminUser()

  const stats = useMemo(() => {
    return {
      reports: data?.reports.length ?? 0,
      blocksGiven: data?.blocks_given.length ?? 0,
      blocksReceived: data?.blocks_received.length ?? 0,
      activeMutes: data?.active_mutes.length ?? 0,
    }
  }, [data])

  return (
    <div className='space-y-4'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>User Detail</h1>
          <p className='text-sm text-muted-foreground'>
            Moderation history and account controls.
          </p>
        </div>
        <Button asChild variant='outline' size='sm'>
          <Link to='/admin/users'>Back to users</Link>
        </Button>
      </header>

      {isLoading && (
        <p className='text-sm text-muted-foreground'>Loading user detail…</p>
      )}
      {isError && (
        <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3'>
          <p className='text-sm text-destructive'>
            Failed to load user detail.
          </p>
          <Button
            size='sm'
            className='mt-2'
            variant='outline'
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          <section className='rounded-xl border border-border/70 bg-card/60 p-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-lg font-semibold'>
                {data.user.username} (#{data.user.id})
              </h2>
              {data.user.is_banned ? (
                <Badge variant='destructive'>Banned</Badge>
              ) : (
                <Badge variant='outline'>Active</Badge>
              )}
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              {data.user.email}
            </p>
            {data.user.banned_reason && (
              <p className='mt-2 text-xs text-muted-foreground'>
                ban reason: {data.user.banned_reason}
              </p>
            )}

            <div className='mt-4 flex flex-wrap items-center gap-2'>
              <Input
                value={banReason}
                onChange={event => setBanReason(event.target.value)}
                className='max-w-sm'
                placeholder='Ban reason (optional)'
              />
              <Button
                size='sm'
                variant='destructive'
                onClick={() =>
                  banUser.mutate({
                    id: data.user.id,
                    payload: { reason: banReason || undefined },
                  })
                }
              >
                Ban
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => unbanUser.mutate(data.user.id)}
              >
                Unban
              </Button>
            </div>
          </section>

          <section className='grid gap-3 md:grid-cols-4'>
            <article className='rounded-xl border border-border/70 bg-card/60 p-4'>
              <p className='text-xs text-muted-foreground'>Reports</p>
              <p className='mt-1 text-2xl font-bold'>{stats.reports}</p>
            </article>
            <article className='rounded-xl border border-border/70 bg-card/60 p-4'>
              <p className='text-xs text-muted-foreground'>Blocks Given</p>
              <p className='mt-1 text-2xl font-bold'>{stats.blocksGiven}</p>
            </article>
            <article className='rounded-xl border border-border/70 bg-card/60 p-4'>
              <p className='text-xs text-muted-foreground'>Blocks Received</p>
              <p className='mt-1 text-2xl font-bold'>{stats.blocksReceived}</p>
            </article>
            <article className='rounded-xl border border-border/70 bg-card/60 p-4'>
              <p className='text-xs text-muted-foreground'>Active Mutes</p>
              <p className='mt-1 text-2xl font-bold'>{stats.activeMutes}</p>
            </article>
          </section>

          <section className='rounded-xl border border-border/70 bg-card/60 p-4'>
            <h3 className='text-sm font-semibold'>Recent Reports</h3>
            <div className='mt-2 space-y-2'>
              {data.reports.slice(0, 25).map(report => (
                <div
                  key={report.id}
                  className='rounded-lg border border-border/60 p-2 text-xs'
                >
                  <p className='font-semibold'>
                    #{report.id} • {report.target_type} #{report.target_id} •{' '}
                    {report.status}
                  </p>
                  <p className='text-muted-foreground'>{report.reason}</p>
                </div>
              ))}
              {data.reports.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No reports for this user.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
