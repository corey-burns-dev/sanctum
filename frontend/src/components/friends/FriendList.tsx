import { MessageCircle, UserX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateConversation } from '@/hooks/useChat'
import { useFriends, useRemoveFriend } from '@/hooks/useFriends'

export function FriendList() {
    const { data: friends, isLoading } = useFriends()
    const removeFriend = useRemoveFriend()
    const createConversation = useCreateConversation()
    const navigate = useNavigate()

    if (isLoading) {
        return <div className="p-4 text-center text-muted-foreground">Loading friends...</div>
    }

    if (!friends || friends.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-card/50">
                <p className="text-muted-foreground mb-4">You haven't added any friends yet.</p>
                <Button variant="secondary" onClick={() => navigate('/friends?tab=find')}>
                    Find People
                </Button>
            </div>
        )
    }

    const handleMessage = (friendId: number) => {
        createConversation.mutate(
            { participant_ids: [friendId] },
            {
                onSuccess: (conv) => {
                    navigate(`/chat/${conv.id}`)
                },
            }
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {friends.map((friend) => (
                <Card key={friend.id}>
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                            {friend.avatar ? (
                                <img
                                    src={friend.avatar}
                                    alt={friend.username}
                                    className="h-10 w-10 rounded-full object-cover"
                                />
                            ) : (
                                friend.username[0].toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <CardTitle className="text-base truncate">{friend.username}</CardTitle>
                            <CardDescription className="truncate text-xs">
                                {friend.email}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mt-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleMessage(friend.id)}
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Message
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                    if (confirm(`Remove ${friend.username} from friends?`)) {
                                        removeFriend.mutate(friend.id)
                                    }
                                }}
                            >
                                <UserX className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
