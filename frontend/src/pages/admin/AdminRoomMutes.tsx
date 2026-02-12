import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useChatroomMutes,
  useMuteChatroomUser,
  useUnmuteChatroomUser,
} from '@/hooks/useAdminModeration'

export default function AdminRoomMutes() {
  const [chatroomInput, setChatroomInput] = useState('')
  const [targetUserInput, setTargetUserInput] = useState('')
  const [reason, setReason] = useState('')
  const [mutedUntil, setMutedUntil] = useState('')

  const chatroomId = useMemo(() => Number(chatroomInput || 0), [chatroomInput])
  const targetUserId = useMemo(
    () => Number(targetUserInput || 0),
    [targetUserInput]
  )

  const {
    data: mutes = [],
    isLoading,
    isError,
    refetch,
  } = useChatroomMutes(chatroomId)
  const muteUser = useMuteChatroomUser(chatroomId)
  const unmuteUser = useUnmuteChatroomUser(chatroomId)

  return (
    <div className='space-y-4'>
      <header>
        <h1 className='text-2xl font-bold'>Room Mutes</h1>
        <p className='text-sm text-muted-foreground'>
          Manage room-scoped mutes for a chatroom.
        </p>
      </header>

      <section className='rounded-xl border border-border/70 bg-card/60 p-4'>
        <div className='grid gap-2 md:grid-cols-2'>
          <Input
            value={chatroomInput}
            onChange={event => setChatroomInput(event.target.value)}
            placeholder='Chatroom ID'
          />
          <Input
            value={targetUserInput}
            onChange={event => setTargetUserInput(event.target.value)}
            placeholder='User ID to mute'
          />
        </div>

        <div className='mt-2 grid gap-2 md:grid-cols-2'>
          <Input
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder='Reason (optional)'
          />
          <Input
            value={mutedUntil}
            onChange={event => setMutedUntil(event.target.value)}
            placeholder='Muted until (RFC3339 optional)'
          />
        </div>

        <div className='mt-3 flex flex-wrap gap-2'>
          <Button
            size='sm'
            onClick={() =>
              muteUser.mutate({
                userId: targetUserId,
                payload: {
                  reason: reason || undefined,
                  muted_until: mutedUntil || undefined,
                },
              })
            }
            disabled={!chatroomId || !targetUserId}
          >
            Mute User
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => unmuteUser.mutate(targetUserId)}
            disabled={!chatroomId || !targetUserId}
          >
            Unmute User
          </Button>
          <Button size='sm' variant='ghost' onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </section>

      {isLoading && (
        <p className='text-sm text-muted-foreground'>Loading room mutes…</p>
      )}
      {isError && (
        <p className='text-sm text-destructive'>
          Failed to load mutes. Verify room ID and moderation access.
        </p>
      )}

      {!isLoading && !isError && (
        <div className='space-y-2'>
          {mutes.map(mute => (
            <article
              key={mute.id}
              className='rounded-lg border border-border/70 bg-card/60 p-3'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <p className='font-semibold'>
                  user #{mute.user_id} in room #{mute.conversation_id}
                </p>
                <Badge variant='outline'>mute</Badge>
                {mute.muted_until && (
                  <p className='text-xs text-muted-foreground'>
                    until {new Date(mute.muted_until).toLocaleString()}
                  </p>
                )}
              </div>
              {mute.reason && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  {mute.reason}
                </p>
              )}
            </article>
          ))}

          {mutes.length === 0 && (
            <div className='rounded-xl border border-border/70 bg-card/60 p-4 text-sm text-muted-foreground'>
              No active mutes for this room.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
