import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { usePresenceStore } from '@/hooks/usePresence'

type RealtimeEventType =
    | 'post_created'
    | 'post_reaction_updated'
    | 'message_received'
    | 'friend_request_received'
    | 'friend_request_sent'
    | 'friend_request_accepted'
    | 'friend_request_rejected'
    | 'friend_request_cancelled'
    | 'friend_added'
    | 'friend_removed'
    | 'friend_presence_changed'
    | 'friends_online_snapshot'

interface RealtimeEvent {
    type?: RealtimeEventType
    payload?: Record<string, unknown>
}

export interface AppNotification {
    id: string
    title: string
    description: string
    createdAt: string
    read: boolean
}

interface NotificationStore {
    items: AppNotification[]
    add: (item: Omit<AppNotification, 'id' | 'read'>) => void
    markAllRead: () => void
    unreadCount: () => number
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    items: [],
    add: (item) =>
        set((state) => ({
            items: [
                {
                    ...item,
                    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    read: false,
                },
                ...state.items,
            ].slice(0, 30),
        })),
    markAllRead: () =>
        set((state) => ({
            items: state.items.map((item) => ({ ...item, read: true })),
        })),
    unreadCount: () => get().items.filter((item) => !item.read).length,
}))

function asNumber(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asString(v: unknown): string | null {
    return typeof v === 'string' && v.trim().length > 0 ? v : null
}

export function useRealtimeNotifications(enabled = true) {
    const queryClient = useQueryClient()
    const reconnectTimeoutRef = useRef<number | null>(null)
    const addNotification = useNotificationStore((state) => state.add)
    const setOnline = usePresenceStore((state) => state.setOnline)
    const setOffline = usePresenceStore((state) => state.setOffline)
    const setInitialOnlineUsers = usePresenceStore((state) => state.setInitialOnlineUsers)

    useEffect(() => {
        if (!enabled) return

        const token = localStorage.getItem('token')
        if (!token) return

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.hostname
        const port = import.meta.env.VITE_API_PORT || '8375'
        const wsUrl = `${protocol}//${host}:${port}/api/ws?token=${token}`

        let closedByEffect = false
        let ws: WebSocket | null = null

        const connect = () => {
            if (closedByEffect) return
            ws = new WebSocket(wsUrl)

            ws.onmessage = (event) => {
                let data: RealtimeEvent
                try {
                    data = JSON.parse(event.data) as RealtimeEvent
                } catch {
                    return
                }

                const payload = data.payload ?? {}
                switch (data.type) {
                    case 'post_created':
                    case 'post_reaction_updated':
                        void queryClient.invalidateQueries({ queryKey: ['posts'] })
                        break
                    case 'message_received': {
                        void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
                        const username = asString(
                            (payload.from_user as Record<string, unknown>)?.username
                        )
                        const preview = asString(payload.preview)
                        if (username) {
                            const desc = preview ? `"${preview}"` : 'New message'
                            toast.message(`${username} sent a message`, { description: desc })
                            addNotification({
                                title: `${username} sent a message`,
                                description: desc,
                                createdAt: new Date().toISOString(),
                            })
                        }
                        break
                    }
                    case 'friend_request_received': {
                        void queryClient.invalidateQueries({ queryKey: ['friends'] })
                        const username = asString(
                            (payload.from_user as Record<string, unknown>)?.username
                        )
                        if (username) {
                            toast.message('New friend request', {
                                description: `${username} sent you a request`,
                            })
                            addNotification({
                                title: 'New friend request',
                                description: `${username} sent you a request`,
                                createdAt: new Date().toISOString(),
                            })
                        }
                        break
                    }
                    case 'friend_request_accepted': {
                        void queryClient.invalidateQueries({ queryKey: ['friends'] })
                        const username = asString(
                            (payload.friend_user as Record<string, unknown>)?.username
                        )
                        if (username) {
                            toast.success(`${username} accepted your friend request`)
                            addNotification({
                                title: 'Friend request accepted',
                                description: `${username} is now your friend`,
                                createdAt: new Date().toISOString(),
                            })
                        }
                        break
                    }
                    case 'friend_added':
                    case 'friend_removed':
                    case 'friend_request_sent':
                    case 'friend_request_rejected':
                    case 'friend_request_cancelled':
                        void queryClient.invalidateQueries({ queryKey: ['friends'] })
                        break
                    case 'friend_presence_changed': {
                        const friendID = asNumber(payload.user_id)
                        const status = asString(payload.status)
                        const username = asString(payload.username) ?? 'A friend'
                        if (!friendID || !status) break

                        if (status === 'online') {
                            setOnline(friendID)
                            toast.message(`${username} is online`)
                        } else if (status === 'offline') {
                            setOffline(friendID)
                            toast.message(`${username} went offline`)
                        }
                        break
                    }
                    case 'friends_online_snapshot': {
                        const userIDs = Array.isArray(payload.user_ids)
                            ? (payload.user_ids as unknown[])
                                  .map((id) => asNumber(id))
                                  .filter((id): id is number => id !== null)
                            : []
                        if (userIDs.length > 0) {
                            setInitialOnlineUsers(userIDs)
                        }
                        break
                    }
                }
            }

            ws.onclose = () => {
                if (closedByEffect) return
                reconnectTimeoutRef.current = window.setTimeout(connect, 1500)
            }

            ws.onerror = () => {
                ws?.close()
            }
        }

        connect()

        return () => {
            closedByEffect = true
            if (reconnectTimeoutRef.current !== null) {
                window.clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
            ws?.close()
        }
    }, [enabled, queryClient, addNotification, setOnline, setOffline, setInitialOnlineUsers])
}
