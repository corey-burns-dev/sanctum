import { useQuery } from '@tanstack/react-query'
import { Hash, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getAuthToken, getCurrentUser } from '@/hooks'

type GameState = {
    board: string[][]
    status: 'pending' | 'active' | 'finished' | 'cancelled'
    winner_id: number | null
    next_turn: number
    is_draw: boolean
}

type ChatMessage = {
    user_id: number
    username: string
    text: string
}

export default function TicTacToe() {
    const { id } = useParams()
    const navigate = useNavigate()
    const currentUser = getCurrentUser()
    const token = getAuthToken()

    const [gameState, setGameState] = useState<GameState | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [_connectionError, setConnectionError] = useState(false)

    const ws = useRef<WebSocket | null>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)
    const hasJoined = useRef(false)
    const connectionErrorRef = useRef(false)
    const shouldAutoJoinRef = useRef(false)
    const allowLeaveOnUnmountRef = useRef(false)

    const { data: room, isError } = useQuery({
        queryKey: ['gameRoom', id],
        queryFn: () => apiClient.getGameRoom(Number(id)),
        enabled: !!id,
    })
    useEffect(() => {
        if (isError) {
            toast.error('Game not found')
            navigate('/games')
        }
    }, [isError, navigate])

    useEffect(() => {
        if (!room || !currentUser) return

        // Initialize game state
        try {
            const boardData =
                room.current_state === '{}' || !room.current_state
                    ? [
                          ['', '', ''],
                          ['', '', ''],
                          ['', '', ''],
                      ]
                    : JSON.parse(room.current_state)

            setGameState({
                board: boardData,
                status: room.status as GameState['status'],
                winner_id: room.winner_id ?? null,
                next_turn: room.next_turn_id,
                is_draw: room.is_draw,
            })
        } catch (e) {
            console.error('Failed to initialize board', e)
        }
    }, [room, currentUser])

    useEffect(() => {
        if (
            room &&
            currentUser &&
            room.status === 'pending' &&
            room.creator_id !== currentUser.id &&
            !hasJoined.current
        ) {
            shouldAutoJoinRef.current = true
            // If socket is already open, join immediately
            if (ws.current?.readyState === WebSocket.OPEN) {
                hasJoined.current = true
                ws.current.send(
                    JSON.stringify({
                        type: 'join_room',
                        room_id: Number(id),
                    })
                )
                shouldAutoJoinRef.current = false
            }
        } else {
            shouldAutoJoinRef.current = false
        }
    }, [room, currentUser, id])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            allowLeaveOnUnmountRef.current = true
        }, 0)

        return () => window.clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (!id || !token) return

        // Reset error state when attempting connection
        setConnectionError(false)
        connectionErrorRef.current = false
        hasJoined.current = false

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const wsUrl = `${protocol}//${host}/api/ws/game?room_id=${id}&token=${token}`

        try {
            ws.current = new WebSocket(wsUrl)
        } catch (e) {
            console.error('Failed to create WebSocket:', e)
            if (!connectionErrorRef.current) {
                toast.error('Connection Failed', {
                    description: 'Could not establish WebSocket connection',
                })
                connectionErrorRef.current = true
                setConnectionError(true)
            }
            return
        }

        ws.current.onopen = () => {
            setConnectionError(false)
            connectionErrorRef.current = false
            // If we computed that we should auto-join, do so (uses stable ref)
            if (shouldAutoJoinRef.current && !hasJoined.current) {
                hasJoined.current = true
                ws.current?.send(
                    JSON.stringify({
                        type: 'join_room',
                        room_id: Number(id),
                    })
                )
                shouldAutoJoinRef.current = false
            }
        }

        ws.current.onmessage = (event) => {
            try {
                const action = JSON.parse(event.data)
                switch (action.type) {
                    case 'game_state':
                        setGameState(action.payload)
                        break
                    case 'game_started':
                        setGameState((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      status: action.payload.status,
                                      next_turn: action.payload.next_turn,
                                  }
                                : null
                        )
                        toast.success('Game Started!', {
                            description: 'Your opponent has joined.',
                        })
                        break
                    case 'chat':
                        setMessages((prev) => [
                            ...prev,
                            {
                                user_id: action.user_id,
                                username: action.payload.username || 'Opponent',
                                text: action.payload.text,
                            },
                        ])
                        break
                    case 'error':
                        toast.error('Game Error', {
                            description: action.payload.message,
                        })
                        break
                }
            } catch (e) {
                console.error('Failed to parse message:', e)
            }
        }

        ws.current.onerror = () => {
            if (!connectionErrorRef.current) {
                console.error('WebSocket error')
                connectionErrorRef.current = true
                setConnectionError(true)
            }
        }

        ws.current.onclose = () => {
            // Connection closed
        }

        return () => {
            if (ws.current) {
                ws.current.close()
                ws.current = null
            }
        }
    }, [id, token])

    useEffect(() => {
        if (!id || !token) return

        const roomId = Number(id)
        if (Number.isNaN(roomId)) return

        const leaveWithKeepalive = () => {
            void fetch(`/api/games/rooms/${roomId}/leave`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                keepalive: true,
            })
        }

        const handleBeforeUnload = () => {
            leaveWithKeepalive()
        }

        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            if (!allowLeaveOnUnmountRef.current) return
            void apiClient.leaveGameRoom(roomId)
        }
    }, [id, token])

    // Auto-join effect - separate from WebSocket connection
    useEffect(() => {
        if (!room || !currentUser || !ws.current || ws.current.readyState !== WebSocket.OPEN) return

        // Only auto-join if not creator and haven't already joined
        if (!hasJoined.current && room.creator_id !== currentUser.id) {
            hasJoined.current = true
            ws.current.send(
                JSON.stringify({
                    type: 'join_room',
                    room_id: Number(id),
                })
            )
        }
    }, [room, currentUser, id])

    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length])

    const makeMove = (x: number, y: number) => {
        if (!gameState || gameState.status !== 'active' || gameState.next_turn !== currentUser?.id)
            return
        if (gameState.board[x][y] !== '') return

        ws.current?.send(
            JSON.stringify({
                type: 'make_move',
                room_id: Number(id),
                payload: { x, y },
            })
        )
    }

    const joinGame = () => {
        ws.current?.send(
            JSON.stringify({
                type: 'join_room',
                room_id: Number(id),
            })
        )
    }

    const sendChat = () => {
        if (!chatInput.trim()) return
        ws.current?.send(
            JSON.stringify({
                type: 'chat',
                room_id: Number(id),
                payload: { text: chatInput.trim(), username: currentUser?.username },
            })
        )
        setChatInput('')
    }

    if (!room || !gameState) return <div className="p-8 text-center">Loading game...</div>

    const isCreator = currentUser?.id === room.creator_id
    const isOpponent = currentUser?.id === room.opponent_id
    const isPlayer = isCreator || isOpponent
    const canJoin = !isPlayer && room.status === 'pending'
    const isMyTurn = gameState.status === 'active' && gameState.next_turn === currentUser?.id

    const getStatusText = () => {
        if (gameState.status === 'pending') return 'Waiting for opponent...'
        if (gameState.status === 'finished') {
            if (gameState.is_draw) return 'Game Draw!'
            return gameState.winner_id === currentUser?.id ? '🎉 You Won!' : '💀 You Lost!'
        }
        return isMyTurn ? '👉 Your Turn' : '⌛ Processing...'
    }

    return (
        <div className="h-full bg-background overflow-hidden">
            <div className="mx-auto grid h-full max-w-6xl gap-4 px-4 py-4 lg:grid-cols-3 lg:gap-6">
                <div className="overflow-y-auto pr-1">
                    <Card className="mx-auto w-fit border-2">
                        <CardHeader className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 pb-2">
                            <div>
                                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                    <Hash className="w-6 h-6 text-primary" /> Tic-Tac-Toe
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">Room ID: #{id}</p>
                            </div>
                            <div
                                className={`px-4 py-2 rounded-full font-bold text-sm ${
                                    isMyTurn
                                        ? 'bg-primary text-primary-foreground animate-pulse'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                            >
                                {getStatusText()}
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center px-4 pb-4 pt-4">
                            {/* The Board */}
                            <div className="grid grid-cols-3 gap-3 rounded-2xl border-4 border-muted bg-muted p-3 shadow-inner">
                                {gameState.board.map((row, x) =>
                                    row.map((cell, y) => {
                                        const cellId = `cell-${x}-${y}`
                                        return (
                                            <button
                                                type="button"
                                                key={cellId}
                                                onClick={() => makeMove(x, y)}
                                                disabled={
                                                    gameState.status !== 'active' ||
                                                    !isMyTurn ||
                                                    cell !== ''
                                                }
                                                className={`flex h-20 w-20 items-center justify-center rounded-xl text-5xl font-black transition-all md:h-24 md:w-24
                                                    ${cell === '' && isMyTurn ? 'bg-background hover:bg-primary/10 hover:scale-105 cursor-pointer' : 'bg-background/50 cursor-default'}
                                                    ${cell === 'X' ? 'text-primary' : 'text-indigo-500'}
                                                    shadow-[0_4px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none
                                                `}
                                            >
                                                {cell}
                                            </button>
                                        )
                                    })
                                )}
                            </div>

                            {canJoin && (
                                <Button
                                    size="lg"
                                    className="mt-4 px-8 py-5 text-lg"
                                    onClick={joinGame}
                                >
                                    Join & Play
                                </Button>
                            )}

                            {gameState.status === 'finished' && (
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={() => navigate('/games')}
                                >
                                    Back to Games
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex min-h-0 flex-col">
                    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-2">
                        <div className="p-4 bg-muted/20 border-b font-bold flex items-center gap-2">
                            <Send className="w-4 h-4 text-primary" /> Game Chat
                        </div>
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((m, i) => (
                                <div
                                    key={`${m.user_id}-${i}-${m.text.slice(0, 20)}`}
                                    className={`flex flex-col ${m.user_id === currentUser?.id ? 'items-end' : 'items-start'}`}
                                >
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                                        {m.username}
                                    </span>
                                    <div
                                        className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] ${
                                            m.user_id === currentUser?.id
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-muted rounded-tl-none'
                                        }`}
                                    >
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </CardContent>
                        <div className="p-4 border-t bg-background">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="GGWP..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                />
                                <Button size="icon" onClick={sendChat}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                    <div className="rounded-xl border-2 bg-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                                X
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
                                    Creator
                                </p>
                                <p className="font-bold">{room.creator.username}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border-2 bg-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 font-bold text-indigo-500">
                                O
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
                                    Opponent
                                </p>
                                <p className="font-bold">
                                    {room.opponent?.username ||
                                        (gameState.status === 'pending' ? '...' : 'Bot')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
