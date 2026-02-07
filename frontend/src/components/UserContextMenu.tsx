import { MessageCircle, User as UserIcon, UserMinus, UserPlus, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@/api/types'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useCreateConversation } from '@/hooks/useChat'
import { useFriendshipStatus, useRemoveFriend, useSendFriendRequest } from '@/hooks/useFriends'
import { getCurrentUser } from '@/hooks/useUsers'

interface UserContextMenuProps {
    user: User
    children: React.ReactNode
}

export function UserContextMenu({ user, children }: UserContextMenuProps) {
    const navigate = useNavigate()
    const currentUser = getCurrentUser()
    const { data: statusData, isLoading } = useFriendshipStatus(user.id)
    const sendRequest = useSendFriendRequest()
    const removeFriend = useRemoveFriend()
    const createConversation = useCreateConversation()

    const isSelf = currentUser && currentUser.id === user.id
    const status = statusData?.status || 'none'

    const handleMessage = () => {
        createConversation.mutate(
            { participant_ids: [user.id] },
            {
                onSuccess: (conv) => {
                    navigate(`/messages/${conv.id}`)
                },
            }
        )
    }

    const handleVideoChat = () => {
        // Generate a room ID based on sorted user IDs for consistency
        const ids = [currentUser?.id ?? 0, user.id].sort((a, b) => a - b)
        const roomId = `vc-${ids[0]}-${ids[1]}`
        navigate(`/videochat?room=${encodeURIComponent(roomId)}`)
    }

    if (isSelf) {
        return <>{children}</>
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                <ContextMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.username}</p>
                        {user.bio && (
                            <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
                        )}
                    </div>
                </ContextMenuLabel>
                <ContextMenuSeparator />

                <ContextMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                </ContextMenuItem>

                <ContextMenuItem onClick={handleMessage}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    <span>Message</span>
                </ContextMenuItem>

                <ContextMenuItem onClick={handleVideoChat}>
                    <Video className="mr-2 h-4 w-4" />
                    <span>Video Chat</span>
                </ContextMenuItem>

                <ContextMenuSeparator />

                {(status === 'none' ||
                    status === 'pending_sent' ||
                    status === 'pending_received') && (
                    <ContextMenuItem
                        onClick={() => sendRequest.mutate(user.id)}
                        disabled={sendRequest.isPending || isLoading || status === 'pending_sent'}
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>{status === 'pending_sent' ? 'Request Sent' : 'Add Friend'}</span>
                    </ContextMenuItem>
                )}

                {status === 'friends' && (
                    <ContextMenuItem
                        onClick={() => {
                            if (confirm(`Remove ${user.username} from friends?`)) {
                                removeFriend.mutate(user.id)
                            }
                        }}
                        className="text-destructive focus:text-destructive"
                        disabled={removeFriend.isPending}
                    >
                        <UserMinus className="mr-2 h-4 w-4" />
                        <span>Remove Friend</span>
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    )
}
