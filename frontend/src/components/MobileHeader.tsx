import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModeToggle } from '@/components/mode-toggle'
import { Input } from '@/components/ui/input'

export function MobileHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between z-50 md:hidden">
            <Link
                to="/"
                className="text-xl font-bold bg-linear-to-tr from-primary to-primary/60 bg-clip-text text-transparent"
            >
                Vibeshift
            </Link>

            <div className="flex-1 max-w-[200px] mx-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search"
                        className="h-9 pl-9 rounded-lg bg-muted border-none"
                    />
                </div>
            </div>

            <ModeToggle />
        </header>
    )
}
