import { Compass, Gamepad2, Home, MessageCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getCurrentUser } from '@/hooks'
import { cn } from '@/lib/utils'

export function BottomBar() {
    const location = useLocation()
    const currentUser = getCurrentUser()

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: Compass, label: 'Explore', path: '/posts' },
        { icon: Gamepad2, label: 'Games', path: '/games' },
        { icon: MessageCircle, label: 'Messages', path: '/chat' },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 border-t bg-background px-6 flex items-center justify-between z-50 md:hidden pb-safe">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            'p-2 rounded-lg transition-colors',
                            isActive
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <item.icon
                            className={cn(
                                'w-6 h-6 transition-transform duration-200',
                                isActive && 'scale-110 fill-current'
                            )}
                            strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                )
            })}

            <Link to="/profile">
                <Avatar
                    className={cn(
                        'w-7 h-7 ring-2 transition-all',
                        location.pathname === '/profile'
                            ? 'ring-primary'
                            : 'ring-transparent hover:ring-muted-foreground/30'
                    )}
                >
                    <AvatarImage src={currentUser?.avatar || ''} />
                    <AvatarFallback>
                        {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                </Avatar>
            </Link>
        </nav>
    )
}
