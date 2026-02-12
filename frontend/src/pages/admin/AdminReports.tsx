import { useMemo, useState } from 'react'
import type { ModerationReportTargetType } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useAdminReports,
  useResolveAdminReport,
} from '@/hooks/useAdminModeration'

interface AdminReportsProps {
  fixedTargetType?: ModerationReportTargetType
}

const statuses = ['open', 'resolved', 'dismissed'] as const

export default function AdminReports({ fixedTargetType }: AdminReportsProps) {
  const [status, setStatus] = useState<(typeof statuses)[number]>('open')
  const [resolutionNote, setResolutionNote] = useState<Record<number, string>>(
    {}
  )
  const [targetFilter, setTargetFilter] = useState<
    ModerationReportTargetType | 'all'
  >(fixedTargetType ?? 'all')

  const effectiveTargetType =
    fixedTargetType || (targetFilter === 'all' ? undefined : targetFilter)

  const {
    data: reports = [],
    isLoading,
    isError,
    refetch,
  } = useAdminReports({
    status,
    target_type: effectiveTargetType,
    limit: 200,
  })
  const resolveReport = useResolveAdminReport()

  const title = useMemo(() => {
    if (fixedTargetType === 'post') return 'Reported Posts'
    if (fixedTargetType === 'message') return 'Reported Messages'
    if (fixedTargetType === 'user') return 'Reported Users'
    return 'Reports'
  }, [fixedTargetType])

  return (
    <div className='space-y-4'>
      <header>
        <h1 className='text-2xl font-bold'>{title}</h1>
        <p className='text-sm text-muted-foreground'>
          Review user reports and move them through resolution lifecycle.
        </p>
      </header>

      <div className='flex flex-wrap gap-2'>
        {statuses.map(nextStatus => (
          <Button
            key={nextStatus}
            size='sm'
            variant={status === nextStatus ? 'default' : 'outline'}
            onClick={() => setStatus(nextStatus)}
          >
            {nextStatus}
          </Button>
        ))}

        {!fixedTargetType && (
          <>
            <Button
              size='sm'
              variant={targetFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setTargetFilter('all')}
            >
              all targets
            </Button>
            {(['post', 'message', 'user'] as const).map(target => (
              <Button
                key={target}
                size='sm'
                variant={targetFilter === target ? 'default' : 'outline'}
                onClick={() => setTargetFilter(target)}
              >
                {target}
              </Button>
            ))}
          </>
        )}
      </div>

      {isLoading && (
        <p className='text-sm text-muted-foreground'>Loading reports…</p>
      )}
      {isError && (
        <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3'>
          <p className='text-sm text-destructive'>Failed to load reports.</p>
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
          {reports.map(report => (
            <article
              key={report.id}
              className='rounded-xl border border-border/70 bg-card/60 p-4'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-sm font-semibold'>#{report.id}</p>
                <Badge variant='outline'>{report.target_type}</Badge>
                <Badge variant='outline'>{report.status}</Badge>
                <p className='text-xs text-muted-foreground'>
                  target #{report.target_id} • reporter #{report.reporter_id}
                </p>
              </div>
              <p className='mt-2 text-sm font-medium'>{report.reason}</p>
              {report.details && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  {report.details}
                </p>
              )}

              {status === 'open' && (
                <div className='mt-3 flex flex-wrap items-center gap-2'>
                  <Input
                    value={resolutionNote[report.id] ?? ''}
                    onChange={event =>
                      setResolutionNote(prev => ({
                        ...prev,
                        [report.id]: event.target.value,
                      }))
                    }
                    className='max-w-sm'
                    placeholder='Resolution note (optional)'
                  />
                  <Button
                    size='sm'
                    onClick={() =>
                      resolveReport.mutate({
                        id: report.id,
                        payload: {
                          status: 'resolved',
                          resolution_note: resolutionNote[report.id],
                        },
                      })
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={() =>
                      resolveReport.mutate({
                        id: report.id,
                        payload: {
                          status: 'dismissed',
                          resolution_note: resolutionNote[report.id],
                        },
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </article>
          ))}

          {reports.length === 0 && (
            <div className='rounded-xl border border-border/70 bg-card/60 p-4 text-sm text-muted-foreground'>
              No reports found.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
