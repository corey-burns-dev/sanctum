import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useAdminBanRequests,
  useBanAdminUser,
  useUnbanAdminUser,
} from '@/hooks/useAdminModeration'

export default function AdminBanRequests() {
  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
  } = useAdminBanRequests({ limit: 200 })
  const [banReason, setBanReason] = useState<Record<number, string>>({})
  const banUser = useBanAdminUser()
  const unbanUser = useUnbanAdminUser()

  return (
    <div className='space-y-4'>
      <header>
        <h1 className='text-2xl font-bold'>Ban Requests</h1>
        <p className='text-sm text-muted-foreground'>
          Requests are derived from open user reports grouped by target user.
        </p>
      </header>

      {isLoading && (
        <p className='text-sm text-muted-foreground'>Loading ban requests…</p>
      )}
      {isError && (
        <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3'>
          <p className='text-sm text-destructive'>
            Failed to load ban requests.
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

      {!isLoading && !isError && (
        <div className='space-y-3'>
          {requests.map(request => (
            <article
              key={request.reported_user_id}
              className='rounded-xl border border-border/70 bg-card/60 p-4'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <p className='font-semibold'>
                  {request.user?.username ||
                    `User #${request.reported_user_id}`}
                </p>
                <Badge variant='outline'>
                  {request.report_count} open reports
                </Badge>
                {request.user?.is_banned && (
                  <Badge variant='destructive'>Banned</Badge>
                )}
                <p className='text-xs text-muted-foreground'>
                  latest: {new Date(request.latest_report_at).toLocaleString()}
                </p>
              </div>

              <div className='mt-3 flex flex-wrap items-center gap-2'>
                <Input
                  value={banReason[request.reported_user_id] ?? ''}
                  onChange={event =>
                    setBanReason(prev => ({
                      ...prev,
                      [request.reported_user_id]: event.target.value,
                    }))
                  }
                  className='max-w-sm'
                  placeholder='Ban reason (optional)'
                />
                <Button
                  size='sm'
                  variant='destructive'
                  onClick={() =>
                    banUser.mutate({
                      id: request.reported_user_id,
                      payload: {
                        reason:
                          banReason[request.reported_user_id] || undefined,
                      },
                    })
                  }
                >
                  Ban User
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => unbanUser.mutate(request.reported_user_id)}
                >
                  Unban User
                </Button>
              </div>
            </article>
          ))}

          {requests.length === 0 && (
            <div className='rounded-xl border border-border/70 bg-card/60 p-4 text-sm text-muted-foreground'>
              No ban requests in queue.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
