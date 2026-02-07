import { MessageCircle, User as UserIcon, UserMinus, UserPlus, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@/api/types'
import { UserContextMenu } from '@/components/UserContextMenu'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCreateConversation } from '@/hooks/useChat'
import { useFriendshipStatus, useRemoveFriend, useSendFriendRequest } from '@/hooks/useFriends'
import { getCurrentUser } from '@/hooks/useUsers'

interface UserMenuProps {
    user: User
    children: React.ReactNode
}

export function UserMenu({ user, children }: UserMenuProps) {
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
        const ids = [currentUser?.id ?? 0, user.id].sort((a, b) => a - b)
        const roomId = `vc-${ids[0]}-${ids[1]}`
        navigate(`/videochat?room=${encodeURIComponent(roomId)}`)
    }

    if (isSelf) {
        return <>{children}</>
    }

    return (
        <UserContextMenu user={user}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild className="cursor-pointer">
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{user.username}</p>
                            {user.bio && (
                                <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
                            )}
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>View Profile</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleMessage}>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        <span>Message</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleVideoChat}>
                        <Video className="mr-2 h-4 w-4" />
                        <span>Video Chat</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {(status === 'none' ||
                        status === 'pending_sent' ||
                        status === 'pending_received') && (
                        <DropdownMenuItem
                            onClick={() => sendRequest.mutate(user.id)}
                            disabled={
                                sendRequest.isPending || isLoading || status === 'pending_sent'
                            }
                        >
                            <UserPlus className="mr-2 h-4 w-4" />
                            <span>{status === 'pending_sent' ? 'Request Sent' : 'Add Friend'}</span>
                        </DropdownMenuItem>
                    )}

                    {status === 'friends' && (
                        <DropdownMenuItem
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
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </UserContextMenu>
    )
}
