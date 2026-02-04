import { Gamepad2, LogOut, MessageCircle, MessageSquare, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ModeToggle } from '@/components/mode-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getCurrentUser, useIsAuthenticated, useLogout } from '@/hooks'
import { cn } from '@/lib/utils'

export function TopBar() {
    const location = useLocation()
    const isAuthenticated = useIsAuthenticated()
    const currentUser = getCurrentUser()
    const logout = useLogout()

    if (!isAuthenticated) return null

    const navItems = [
        { icon: MessageSquare, label: 'Chat', path: '/chat' },
        { icon: MessageCircle, label: 'Messages', path: '/messages' },
        { icon: Gamepad2, label: 'Games', path: '/games' },
        { icon: User, label: 'Profile', path: '/profile' },
    ]

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(`${path}/`)

    return (
        <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background/80 backdrop-blur-xl z-50 hidden md:flex">
            <div className="w-full px-6 flex items-center justify-between">
                <Link
                    to="/"
                    className="text-xl font-bold bg-linear-to-tr from-primary to-primary/60 bg-clip-text text-transparent"
                >
                    Vibeshift
                </Link>

                <nav className="flex items-center gap-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                'h-10 w-12 rounded-full flex items-center justify-center transition-all',
                                isActive(item.path)
                                    ? 'bg-primary/10 text-primary shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="sr-only">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    <ModeToggle />
                    {currentUser ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="h-10 w-10 rounded-full border border-border/60 bg-background/80 flex items-center justify-center hover:bg-muted/60 transition"
                                >
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={currentUser.avatar} />
                                        <AvatarFallback>
                                            {currentUser.username?.[0]?.toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">
                                            {currentUser.username}
                                        </p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {currentUser.email}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/profile" className="cursor-pointer">
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Profile</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={logout}
                                    className="cursor-pointer text-red-600"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                </div>
            </div>
        </header>
    )
}
