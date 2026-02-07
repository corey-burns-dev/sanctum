import { Bell, LogOut, Search, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ModeToggle } from '@/components/mode-toggle'
import {
    getRouteTitle,
    isRouteActive,
    type NavItem,
    topRouteNav,
    topServiceNav,
} from '@/components/navigation'
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

function NavPill({ item, active }: { item: NavItem; active: boolean }) {
    return (
        <Link
            key={item.path}
            to={item.path}
            className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
        >
            <item.icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
        </Link>
    )
}

export function TopBar() {
    const location = useLocation()
    const isAuthenticated = useIsAuthenticated()
    const currentUser = getCurrentUser()
    const logout = useLogout()

    if (!isAuthenticated) return null

    const pageTitle = getRouteTitle(location.pathname)

    return (
        <header className="fixed top-0 left-0 right-0 z-50 hidden md:block">
            <div className="border-b border-border/70 bg-background/75 shadow-lg backdrop-blur-xl">
                <div className="flex h-14 items-center gap-3 px-3 lg:px-4">
                    <Link to="/" className="inline-flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-linear-to-br from-primary to-primary/70" />
                        <div className="leading-tight">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Sanctum
                            </p>
                            <p className="text-sm font-semibold">{pageTitle}</p>
                        </div>
                    </Link>

                    <Link
                        to="/users"
                        className="ml-1 hidden h-9 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground xl:flex"
                    >
                        <Search className="h-4 w-4" />
                        <span>Search people and rooms</span>
                    </Link>

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                            aria-label="Notifications"
                        >
                            <Bell className="h-4 w-4" />
                        </button>
                        <ModeToggle />

                        {currentUser ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/85 transition-colors hover:bg-card"
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
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center border-t border-border/60 px-3 py-2 lg:px-4">
                    <div className="flex min-w-0 items-center gap-1 overflow-x-auto pr-8">
                        <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Routes
                        </span>
                        {topRouteNav.map((item) => (
                            <NavPill
                                key={item.path}
                                item={item}
                                active={isRouteActive(location.pathname, item.path)}
                            />
                        ))}
                    </div>

                    <div className="mx-6 h-6 w-px shrink-0 bg-border/70" />

                    <div className="flex min-w-0 items-center gap-1 overflow-x-auto pl-8">
                        <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Services
                        </span>
                        {topServiceNav.map((item) => (
                            <NavPill
                                key={item.path}
                                item={item}
                                active={isRouteActive(location.pathname, item.path)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </header>
    )
}
