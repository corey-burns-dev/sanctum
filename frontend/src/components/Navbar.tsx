import { Button } from './Button'

export function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="text-2xl font-bold text-blue-600">
            Vibeshift
          </a>
          <div className="hidden md:flex gap-6">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition">
              Features
            </a>
            <a href="#status" className="text-gray-600 hover:text-gray-900 transition">
              Status
            </a>
            <a href="#docs" className="text-gray-600 hover:text-gray-900 transition">
              Docs
            </a>
          </div>
        </div>
        <Button size="sm" variant="outline">
          Sign In
        </Button>
      </div>
    </nav>
  )
}
