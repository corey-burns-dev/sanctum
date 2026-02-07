import {
    Hash,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    Send,
    Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Conversation, Message, User } from '@/api/types'
import { MessageList } from '@/components/chat/MessageList'
import { ParticipantsList } from '@/components/chat/ParticipantsList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    useAllChatrooms,
    useConversation,
    useJoinChatroom,
    useJoinedChatrooms,
    useMessages,
    useSendMessage,
} from '@/hooks/useChat'
import { useChatWebSocket } from '@/hooks/useChatWebSocket'
import { usePresenceStore } from '@/hooks/usePresence'
import { getCurrentUser } from '@/hooks/useUsers'
import { cn } from '@/lib/utils'

export default function Chat() {
    const { id: urlChatId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [newMessage, setNewMessage] = useState('')
    const [roomFilter, setRoomFilter] = useState<'joined' | 'all'>('joined')
    const [showChatrooms, setShowChatrooms] = useState(true)
    const [showParticipants, setShowParticipants] = useState(true)
    const [messageError, setMessageError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const onlineUserIds = usePresenceStore((state) => state.onlineUserIds)
    const setOnline = usePresenceStore((state) => state.setOnline)
    const setOffline = usePresenceStore((state) => state.setOffline)
    const setInitialOnlineUsers = usePresenceStore((state) => state.setInitialOnlineUsers)

    const currentUser = useMemo(() => getCurrentUser(), [])

    const { data: allChatrooms = [], isLoading: allLoading, error: allError } = useAllChatrooms()
    const { data: joinedChatrooms = [] } = useJoinedChatrooms()
    const joinChatroom = useJoinChatroom()

    const conversations = allChatrooms as Conversation[]
    const activeRooms = useMemo(() => joinedChatrooms as Conversation[], [joinedChatrooms])

    const selectedChatId = useMemo(
        () => (urlChatId ? Number.parseInt(urlChatId, 10) : null),
        [urlChatId]
    )

    const { data: selectedConversation } = useConversation(selectedChatId || 0)

    useEffect(() => {
        if (activeRooms.length > 0 && !selectedChatId) {
            navigate(`/chat/${activeRooms[0].id}`, { replace: true })
        }
    }, [activeRooms, selectedChatId, navigate])

    const { data: messages = [], isLoading } = useMessages(selectedChatId || 0)
    const sendMessage = useSendMessage(selectedChatId || 0)

    const fallbackConversation = useMemo(() => {
        if (!selectedChatId) return null
        return (
            conversations.find((c) => c.id === selectedChatId) ||
            activeRooms.find((c) => c.id === selectedChatId) ||
            null
        )
    }, [conversations, activeRooms, selectedChatId])

    const currentConversation = useMemo(
        () => selectedConversation || fallbackConversation,
        [selectedConversation, fallbackConversation]
    )

    const isJoinedViaList = useMemo(
        () => joinedChatrooms.some((c) => c.id === selectedChatId),
        [joinedChatrooms, selectedChatId]
    )

    const userIsJoined = useMemo(() => {
        if (!currentConversation) return false
        const fromChatrooms = (currentConversation as Conversation & { is_joined?: boolean })
            .is_joined
        if (typeof fromChatrooms === 'boolean') return fromChatrooms
        if (!currentUser) return isJoinedViaList
        return (
            currentConversation.participants?.some((p) => p.id === currentUser.id) ||
            isJoinedViaList ||
            false
        )
    }, [currentConversation, currentUser, isJoinedViaList])

    const isRoomJoined = useCallback(
        (room: Conversation & { is_joined?: boolean }) => {
            if (typeof room.is_joined === 'boolean') {
                return room.is_joined
            }
            return activeRooms.some((joined) => joined.id === room.id)
        },
        [activeRooms]
    )

    const displayedRooms = useMemo(() => {
        if (roomFilter === 'joined') {
            return activeRooms
        }
        return conversations
    }, [roomFilter, activeRooms, conversations])

    const [participants, setParticipants] = useState<
        Record<number, { id: number; username?: string; online?: boolean; typing?: boolean }>
    >({})

    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages.length])

    useEffect(() => {
        if (!selectedChatId || !currentConversation) {
            setParticipants({})
            return
        }

        const usersList: User[] = currentConversation.participants || []
        const map: Record<
            number,
            { id: number; username?: string; online?: boolean; typing?: boolean }
        > = {}

        const shouldIncludeCurrentUser =
            !!currentUser && (userIsJoined || usersList.some((u) => u.id === currentUser.id))

        if (currentUser && shouldIncludeCurrentUser) {
            map[currentUser.id] = {
                id: currentUser.id,
                username: currentUser.username,
                online: true,
                typing: false,
            }
        }

        for (const u of usersList) {
            if (!currentUser || u.id !== currentUser.id) {
                map[u.id] = {
                    id: u.id,
                    username: u.username,
                    online: onlineUserIds.has(u.id),
                    typing: false,
                }
            }
        }

        setParticipants(map)
    }, [selectedChatId, currentConversation, currentUser, onlineUserIds, userIsJoined])

    const onMessage = useCallback((_msg: Message) => {}, [])

    const onPresence = useCallback(
        (userId: number, username: string, status: string) => {
            const online = status === 'online' || status === 'connected'
            setParticipants((prev) => ({
                ...prev,
                [userId]: { ...(prev?.[userId] || { id: userId, username }), online },
            }))
            if (online) setOnline(userId)
            else setOffline(userId)
        },
        [setOnline, setOffline]
    )

    const onConnectedUsers = useCallback(
        (userIds: number[]) => {
            setInitialOnlineUsers(userIds)
        },
        [setInitialOnlineUsers]
    )

    const onParticipantsUpdate = useCallback(
        (participantsList: User[]) => {
            const map: Record<
                number,
                { id: number; username?: string; online?: boolean; typing?: boolean }
            > = {}
            if (currentUser && userIsJoined) {
                map[currentUser.id] = {
                    id: currentUser.id,
                    username: currentUser.username,
                    online: true,
                    typing: false,
                }
            }
            for (const u of participantsList) {
                if (!currentUser || u.id !== currentUser.id) {
                    map[u.id] = {
                        id: u.id,
                        username: u.username,
                        online: onlineUserIds.has(u.id),
                        typing: false,
                    }
                }
            }
            setParticipants(map)
        },
        [currentUser, onlineUserIds, userIsJoined]
    )

    const { isJoined: wsIsJoined } = useChatWebSocket({
        conversationId: selectedChatId || 0,
        enabled: !!selectedChatId && userIsJoined,
        onMessage,
        onPresence,
        onConnectedUsers,
        onParticipantsUpdate,
    })

    const handleSendMessage = useCallback(() => {
        if (!newMessage.trim() || !selectedChatId || !currentUser) return
        const tempId = crypto.randomUUID()
        const messageContent = newMessage

        setNewMessage('')
        sendMessage.mutate(
            { content: messageContent, message_type: 'text', metadata: { tempId } },
            {
                onError: (error) => {
                    console.error('Failed to send message:', error)
                    setMessageError('Failed to send message')
                },
            }
        )
    }, [newMessage, selectedChatId, currentUser, sendMessage])

    const handleKeyPress = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
            }
        },
        [handleSendMessage]
    )

    const handleJoinConversation = useCallback(
        (id: number) => {
            joinChatroom.mutate(id, {
                onSuccess: () => {
                    navigate(`/chat/${id}`)
                    setRoomFilter('joined')
                },
            })
        },
        [joinChatroom, navigate]
    )

    const handleSelectConversation = useCallback(
        (id: number) => {
            const conv = conversations.find((c) => c.id === id) as
                | (Conversation & {
                      is_joined?: boolean
                  })
                | null
            if (conv && !isRoomJoined(conv)) {
                handleJoinConversation(id)
            } else {
                navigate(`/chat/${id}`)
            }
        },
        [conversations, navigate, handleJoinConversation, isRoomJoined]
    )

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            {allError && (
                <div className="border-b border-destructive bg-destructive/15 p-3">
                    <p className="text-sm text-destructive">
                        Error loading chatrooms: {String(allError)}
                    </p>
                </div>
            )}

            <div className="flex min-h-0 flex-1 overflow-hidden">
                <aside
                    className={cn(
                        'hidden shrink-0 border-r border-border/70 bg-card/40 transition-all duration-200 md:flex md:flex-col',
                        showChatrooms ? 'w-72' : 'w-12'
                    )}
                >
                    <div className="flex h-12 items-center border-b border-border/70 px-2">
                        <button
                            type="button"
                            onClick={() => setShowChatrooms((prev) => !prev)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                            aria-label={
                                showChatrooms
                                    ? 'Collapse chatrooms panel'
                                    : 'Expand chatrooms panel'
                            }
                        >
                            {showChatrooms ? (
                                <PanelLeftClose className="h-4 w-4" />
                            ) : (
                                <PanelLeftOpen className="h-4 w-4" />
                            )}
                        </button>
                        {showChatrooms && (
                            <h2 className="ml-2 flex items-center gap-2 text-sm font-semibold">
                                <Hash className="h-4 w-4 text-primary" />
                                Chatrooms
                            </h2>
                        )}
                    </div>

                    {showChatrooms && (
                        <>
                            <div className="grid grid-cols-2 gap-1 border-b border-border/70 p-2">
                                <button
                                    type="button"
                                    onClick={() => setRoomFilter('joined')}
                                    className={cn(
                                        'rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors',
                                        roomFilter === 'joined'
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                    )}
                                >
                                    Joined ({activeRooms.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRoomFilter('all')}
                                    className={cn(
                                        'rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors',
                                        roomFilter === 'all'
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                    )}
                                >
                                    All ({conversations.length})
                                </button>
                            </div>

                            <ScrollArea className="min-h-0 flex-1">
                                <div className="space-y-1.5 p-2">
                                    {allLoading ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            Loading chatrooms...
                                        </div>
                                    ) : displayedRooms.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            {roomFilter === 'joined'
                                                ? 'No joined chatrooms yet.'
                                                : 'No chatrooms available.'}
                                        </div>
                                    ) : (
                                        displayedRooms.map((room) => {
                                            const joined = isRoomJoined(room)
                                            const selected = selectedChatId === room.id

                                            return (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    onClick={() =>
                                                        handleSelectConversation(room.id)
                                                    }
                                                    className={cn(
                                                        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                                                        selected
                                                            ? 'border-primary/30 bg-primary/10'
                                                            : 'border-transparent hover:border-border/60 hover:bg-muted/60'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="truncate text-sm font-semibold text-foreground">
                                                            {room.name || `Room ${room.id}`}
                                                        </p>
                                                        {!joined && roomFilter === 'all' && (
                                                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                                Join
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                        {room.participants?.length || 0} members
                                                    </p>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </aside>

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex h-12 items-center justify-between border-b border-border/70 bg-card/35 px-3">
                        <div className="min-w-0">
                            {currentConversation ? (
                                <>
                                    <h3 className="truncate text-sm font-semibold text-foreground">
                                        {currentConversation.name ||
                                            `Room ${currentConversation.id}`}
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground">
                                        {currentConversation.participants?.length || 0} participants
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm font-medium text-muted-foreground">
                                    Select a chatroom
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5" />
                    </div>

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="mx-auto w-full max-w-3xl p-4">
                            <MessageList
                                messages={messages}
                                isLoading={isLoading}
                                currentUserId={currentUser?.id}
                            />
                            <div ref={messagesEndRef} className="h-2" />
                        </div>
                    </ScrollArea>

                    <div className="border-t border-border/70 bg-card/25 p-3">
                        <div className="mx-auto w-full max-w-3xl">
                            {messageError && (
                                <p className="mb-2 px-1 text-xs font-medium text-destructive">
                                    {messageError}
                                </p>
                            )}

                            {userIsJoined ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder={
                                            wsIsJoined ? 'Type a message...' : 'Connecting...'
                                        }
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        disabled={!wsIsJoined}
                                        className="h-10 flex-1 rounded-full border-border/60 bg-card"
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim() || !wsIsJoined}
                                        className="h-10 w-10 rounded-full p-0"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                                    <p className="text-xs text-muted-foreground">
                                        Join this room to send messages.
                                    </p>
                                    <Button
                                        onClick={() =>
                                            selectedChatId && handleJoinConversation(selectedChatId)
                                        }
                                        disabled={joinChatroom.isPending}
                                        size="sm"
                                        className="rounded-lg"
                                    >
                                        {joinChatroom.isPending ? 'Joining...' : 'Join'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <aside
                    className={cn(
                        'hidden shrink-0 border-l border-border/70 bg-card/35 transition-all duration-200 lg:flex lg:flex-col',
                        showParticipants ? 'w-60' : 'w-12'
                    )}
                >
                    <div className="flex h-12 items-center border-b border-border/70 px-2">
                        {showParticipants && (
                            <h2 className="ml-1 flex items-center gap-2 text-sm font-semibold">
                                <Users className="h-4 w-4" />
                                Members
                            </h2>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowParticipants((prev) => !prev)}
                            className={cn(
                                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground',
                                showParticipants ? 'ml-auto' : 'mx-auto'
                            )}
                            aria-label={
                                showParticipants ? 'Collapse members panel' : 'Expand members panel'
                            }
                        >
                            {showParticipants ? (
                                <PanelRightClose className="h-4 w-4" />
                            ) : (
                                <PanelRightOpen className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    {showParticipants && (
                        <ScrollArea className="min-h-0 flex-1">
                            <div className="p-2">
                                <ParticipantsList
                                    participants={participants}
                                    onlineUserIds={onlineUserIds}
                                />
                            </div>
                        </ScrollArea>
                    )}
                    {showParticipants && (
                        <div className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
                            {Object.keys(participants).length} people in room
                        </div>
                    )}
                </aside>
            </div>
        </div>
    )
}
