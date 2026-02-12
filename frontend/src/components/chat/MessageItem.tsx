import { Flag } from 'lucide-react'
import { memo, useMemo } from 'react'
import { toast } from 'sonner'
import type { Message, MessageReactionSummary } from '@/api/types'
import { UserMenu } from '@/components/UserMenu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useAddMessageReaction,
  useRemoveMessageReaction,
} from '@/hooks/useChat'
import { useReportMessage } from '@/hooks/useModeration'
import { formatTimestamp, getAvatarUrl, getUserColor } from '@/lib/chat-utils'

interface MessageItemProps {
  message: Message
  isOwnMessage: boolean
  currentUserId?: number
  isDirectMessage?: boolean
  showReadReceipt?: boolean
  conversationId?: number
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮']

function computeReactionSummary(
  message: Message,
  currentUserId?: number
): MessageReactionSummary[] {
  if (Array.isArray(message.reaction_summary)) {
    return message.reaction_summary
  }

  const reactions = Array.isArray(message.reactions) ? message.reactions : []
  if (reactions.length === 0) return []

  const byEmoji = new Map<string, { count: number; reacted_by_me: boolean }>()
  for (const reaction of reactions) {
    const previous = byEmoji.get(reaction.emoji) || {
      count: 0,
      reacted_by_me: false,
    }
    byEmoji.set(reaction.emoji, {
      count: previous.count + 1,
      reacted_by_me:
        previous.reacted_by_me || reaction.user_id === currentUserId,
    })
  }

  return Array.from(byEmoji.entries()).map(([emoji, value]) => ({
    emoji,
    count: value.count,
    reacted_by_me: value.reacted_by_me,
  }))
}

function formatReadReceipt(message: Message): string {
  if (!message.is_read) return 'Sent'
  if (!message.read_at) return 'Read'
  return `Read ${new Date(message.read_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function renderMessageWithMentions(content: string) {
  const tokens = content.split(/(@[a-zA-Z0-9_]{2,32})/g)
  let cursor = 0
  return tokens.map(token => {
    const tokenStart = cursor
    cursor += token.length
    const key = `${tokenStart}:${token}`
    const isMention = /^@[a-zA-Z0-9_]{2,32}$/.test(token)
    if (!isMention) {
      return <span key={`plain-${key}`}>{token}</span>
    }
    return (
      <span
        key={`mention-${key}`}
        className='rounded bg-primary/15 px-1 py-0.5 font-semibold text-primary'
      >
        {token}
      </span>
    )
  })
}

export const MessageItem = memo(function MessageItem({
  message,
  isOwnMessage,
  currentUserId,
  isDirectMessage = false,
  showReadReceipt = false,
  conversationId,
}: MessageItemProps) {
  const sender = message.sender
  const resolvedConversationId = conversationId ?? message.conversation_id
  const reactionSummary = useMemo(
    () => computeReactionSummary(message, currentUserId),
    [message, currentUserId]
  )

  const addReaction = useAddMessageReaction(resolvedConversationId)
  const removeReaction = useRemoveMessageReaction(resolvedConversationId)
  const reportMessage = useReportMessage()

  const toggleReaction = (emoji: string) => {
    const existing = reactionSummary.find(item => item.emoji === emoji)
    if (existing?.reacted_by_me) {
      removeReaction.mutate({ messageId: message.id, emoji })
      return
    }
    addReaction.mutate({ messageId: message.id, emoji })
  }

  const handleReport = () => {
    if (!resolvedConversationId) return
    const reason = window.prompt('Reason for reporting this message?')?.trim()
    if (!reason) return
    const details = window.prompt('Additional details (optional)')?.trim()
    reportMessage.mutate(
      {
        conversationId: resolvedConversationId,
        messageId: message.id,
        payload: { reason, details },
      },
      {
        onSuccess: () => toast.success('Message reported'),
        onError: () => toast.error('Failed to report message'),
      }
    )
  }

  return (
    <div className='group flex items-start gap-2.5'>
      {sender ? (
        <UserMenu user={sender}>
          <Avatar className='mt-0.5 h-7 w-7 shrink-0 cursor-pointer transition-opacity hover:opacity-80'>
            <AvatarImage src={sender.avatar || getAvatarUrl(sender.username)} />
            <AvatarFallback className='text-[10px]'>
              {sender.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </UserMenu>
      ) : (
        <Avatar className='mt-0.5 h-7 w-7 shrink-0'>
          <AvatarImage src={getAvatarUrl('unknown')} />
          <AvatarFallback className='text-[10px]'>U</AvatarFallback>
        </Avatar>
      )}
      <div className='min-w-0 flex-1'>
        <div className='mb-0.5 flex items-baseline gap-2'>
          {sender ? (
            <UserMenu user={sender}>
              <span
                className='cursor-pointer text-[13px] font-semibold hover:underline'
                style={{ color: getUserColor(message.sender_id) }}
              >
                {isOwnMessage ? 'You' : sender.username}
              </span>
            </UserMenu>
          ) : (
            <span
              className='text-[13px] font-semibold'
              style={{ color: getUserColor(message.sender_id) }}
            >
              Unknown
            </span>
          )}
          <span className='text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'>
            {formatTimestamp(message.created_at)}
          </span>
          {!isOwnMessage && (
            <button
              type='button'
              onClick={handleReport}
              className='ml-auto inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100'
              title='Report message'
            >
              <Flag className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
        <p className='wrap-break-word whitespace-pre-wrap text-[13px] leading-snug text-foreground/90'>
          {renderMessageWithMentions(message.content)}
        </p>

        {(reactionSummary.length > 0 || Boolean(currentUserId)) && (
          <div className='mt-1.5 flex flex-wrap items-center gap-1'>
            {reactionSummary.map(reaction => (
              <button
                key={`${message.id}-${reaction.emoji}`}
                type='button'
                onClick={() => toggleReaction(reaction.emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  reaction.reacted_by_me
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border/70 bg-card hover:bg-muted/70'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}

            <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={`${message.id}-quick-${emoji}`}
                  type='button'
                  onClick={() => toggleReaction(emoji)}
                  className='inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card text-xs transition-colors hover:bg-muted/70'
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {showReadReceipt && isDirectMessage && isOwnMessage && (
          <p className='mt-1 text-[10px] text-muted-foreground'>
            {formatReadReceipt(message)}
          </p>
        )}
      </div>
    </div>
  )
})
