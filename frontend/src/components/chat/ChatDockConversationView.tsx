import { ArrowLeft, Expand, Send, Smile } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Conversation } from '@/api/types'
import { MessageItem } from '@/components/chat/MessageItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMarkAsRead, useMessages, useSendMessage } from '@/hooks/useChat'
import { usePresenceStore } from '@/hooks/usePresence'
import { getDirectMessageName } from '@/lib/chat-utils'
import { useChatDockStore } from '@/stores/useChatDockStore'

interface ChatDockConversationViewProps {
  conversationId: number
  conversation: Conversation | undefined
  currentUserId: number | undefined
  sendTyping: (isTyping: boolean) => void
}

const QUICK_EMOJI = ['😀', '😂', '😍', '👍', '🔥', '🎉', '😮', '🤝']

export function ChatDockConversationView({
  conversationId,
  conversation,
  currentUserId,
  sendTyping,
}: ChatDockConversationViewProps) {
  const navigate = useNavigate()
  const onlineUserIds = usePresenceStore(s => s.onlineUserIds)
  const { updateDraft, clearDraft, setActiveConversation, close } =
    useChatDockStore()

  const { data: messages = [] } = useMessages(conversationId)
  const sendMessage = useSendMessage(conversationId)
  const markAsRead = useMarkAsRead()

  // Read draft once on mount / conversation switch via ref to avoid re-running effect
  const draftsRef = useRef(useChatDockStore.getState().drafts)
  useEffect(() => {
    draftsRef.current = useChatDockStore.getState().drafts
  })

  const [inputValue, setInputValue] = useState(
    useChatDockStore.getState().drafts[conversationId] || ''
  )
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingDebounceRef = useRef<number | undefined>(undefined)
  const typingInactivityRef = useRef<number | undefined>(undefined)
  const markAsReadRef = useRef(markAsRead)
  markAsReadRef.current = markAsRead

  // Sync draft on conversation switch
  useEffect(() => {
    setInputValue(draftsRef.current[conversationId] || '')
  }, [conversationId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const isDM = conversation ? !conversation.is_group : false
  // Mark as read on mount / conversation switch for DMs only.
  useEffect(() => {
    if (!isDM) return
    markAsReadRef.current.mutate(conversationId)
  }, [conversationId, isDM])

  const name = conversation
    ? isDM
      ? getDirectMessageName(conversation, currentUserId)
      : conversation.name || 'Unnamed Group'
    : 'Loading...'

  const otherUser = isDM
    ? conversation?.participants?.find(p => p.id !== currentUserId)
    : null
  const isOnline = otherUser ? onlineUserIds.has(otherUser.id) : false

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return

    const tempId = Date.now().toString()
    sendMessage.mutate(
      { content: text, message_type: 'text', metadata: { tempId } },
      {
        onSuccess: () => {
          setInputValue('')
          setShowEmojiPicker(false)
          clearDraft(conversationId)
          sendTyping(false)
        },
      }
    )
  }, [inputValue, conversationId, sendMessage, clearDraft, sendTyping])

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value)
      updateDraft(conversationId, value)

      if (typingDebounceRef.current) {
        window.clearTimeout(typingDebounceRef.current)
      }
      typingDebounceRef.current = window.setTimeout(() => {
        if (value.trim()) sendTyping(true)
      }, 500)

      if (typingInactivityRef.current) {
        window.clearTimeout(typingInactivityRef.current)
      }
      typingInactivityRef.current = window.setTimeout(() => {
        sendTyping(false)
      }, 5000)
    },
    [conversationId, updateDraft, sendTyping]
  )

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        window.clearTimeout(typingDebounceRef.current)
      }
      if (typingInactivityRef.current) {
        window.clearTimeout(typingInactivityRef.current)
      }
    }
  }, [])

  const handleExpand = useCallback(() => {
    if (conversation) {
      const path = conversation.is_group
        ? `/chat/${conversationId}`
        : `/messages/${conversationId}`
      close()
      navigate(path)
    }
  }, [conversation, conversationId, close, navigate])

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      {/* Header */}
      <div className='flex items-center gap-2 border-b border-border/50 px-3 py-2'>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7 shrink-0'
          onClick={() => setActiveConversation(null)}
        >
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-1.5'>
            <span className='truncate text-sm font-medium'>{name}</span>
            {isDM && isOnline && (
              <span className='h-2 w-2 shrink-0 rounded-full bg-green-500' />
            )}
          </div>
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7 shrink-0'
          onClick={handleExpand}
          title='Open full view'
        >
          <Expand className='h-3.5 w-3.5' />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className='flex-1'>
        <div ref={scrollRef} className='space-y-2 p-3'>
          {messages.map(msg => (
            <MessageItem
              key={msg.id}
              message={msg}
              isOwnMessage={msg.sender_id === currentUserId}
              currentUserId={currentUserId}
              isDirectMessage={isDM}
              showReadReceipt={isDM}
              conversationId={conversationId}
            />
          ))}
          {messages.length === 0 && (
            <p className='py-8 text-center text-xs text-muted-foreground'>
              No messages yet. Say hello!
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className='flex items-center gap-2 border-t border-border/50 px-3 py-2'>
        <div className='relative flex-1'>
          <Input
            value={inputValue}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder='Type a message...'
            className='h-8 pr-10 text-sm'
          />
          <button
            type='button'
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground'
            title='Insert emoji'
          >
            <Smile className='h-3.5 w-3.5' />
          </button>
          {showEmojiPicker && (
            <div className='absolute bottom-10 right-0 z-30 flex max-w-44 flex-wrap gap-1 rounded-lg border border-border bg-card p-2 shadow-lg'>
              {QUICK_EMOJI.map(emoji => (
                <button
                  key={`dock-emoji-${emoji}`}
                  type='button'
                  onClick={() => {
                    setInputValue(prev => {
                      const next = `${prev}${emoji}`
                      updateDraft(conversationId, next)
                      return next
                    })
                    setShowEmojiPicker(false)
                  }}
                  className='inline-flex h-6 w-6 items-center justify-center rounded text-sm transition-colors hover:bg-muted'
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 shrink-0'
          onClick={handleSend}
          disabled={!inputValue.trim()}
        >
          <Send className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
