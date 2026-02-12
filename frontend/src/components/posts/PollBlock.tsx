import type { Poll } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useVotePoll } from '@/hooks/usePosts'
import { useIsAuthenticated } from '@/hooks/useUsers'
import { cn } from '@/lib/utils'

export function PollBlock({
  poll,
  postId,
  onVoteClick,
}: {
  poll: Poll
  postId: number
  onVoteClick?: (e: React.MouseEvent) => void
}) {
  const isAuthenticated = useIsAuthenticated()
  const votePollMutation = useVotePoll()
  const totalVotes = poll.options.reduce((s, o) => s + (o.votes_count ?? 0), 0)

  const handleVote = (e: React.MouseEvent, optionId: number) => {
    e.stopPropagation()
    onVoteClick?.(e)
    if (!isAuthenticated) return
    votePollMutation.mutate(
      { postId, pollOptionId: optionId },
      { onError: err => console.error('Vote failed:', err) }
    )
  }

  const hasVoted = poll.user_vote_option_id != null
  const interactiveProps = onVoteClick
    ? {
        onClick: onVoteClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onVoteClick(e as unknown as React.MouseEvent)
          }
        },
        role: 'button' as const,
        tabIndex: 0,
      }
    : {}

  return (
    <div
      className='rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3'
      {...interactiveProps}
    >
      <p className='font-medium text-sm'>{poll.question}</p>
      <div className='space-y-2'>
        {poll.options.map(opt => {
          const count = opt.votes_count ?? 0
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0
          const isSelected = poll.user_vote_option_id === opt.id

          return (
            <div key={opt.id} className='relative'>
              {hasVoted || !isAuthenticated ? (
                <div className='space-y-1'>
                  <div className='flex items-center justify-between gap-2 text-sm'>
                    <span
                      className={cn('truncate', isSelected && 'font-medium')}
                    >
                      {opt.option_text}
                    </span>
                    <span className='text-muted-foreground shrink-0'>
                      {count} {count === 1 ? 'vote' : 'votes'}
                    </span>
                  </div>
                  <div className='h-2 w-full rounded-full bg-muted overflow-hidden'>
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isSelected ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                      style={{ width: `${Math.max(pct, 0)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='w-full justify-start h-9'
                  onClick={e => handleVote(e, opt.id)}
                  disabled={votePollMutation.isPending}
                >
                  {opt.option_text}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {totalVotes > 0 && (
        <p className='text-xs text-muted-foreground'>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total
        </p>
      )}
    </div>
  )
}
