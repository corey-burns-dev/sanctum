import { Button } from './components/Button'
import { Navbar } from './components/Navbar'
import { StatusCard } from './components/StatusCard'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to Vibeshift
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A modern full-stack application with a Go backend and React frontend, powered by TanStack Query and Tailwind CSS.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg">Get Started</Button>
            <Button size="lg" variant="outline">Learn More</Button>
          </div>
        </div>
      </section>

      {/* Status Section */}
      <section id="status" className="bg-white py-16 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">System Status</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <StatusCard />
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Features</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Real-time health checks</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Redis integration</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>PostgreSQL support</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Modern UI with Tailwind</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Stack</h3>
              <div className="space-y-2 text-gray-600 text-sm">
                <p><strong>Frontend:</strong> React 19, TypeScript, Vite</p>
                <p><strong>Styling:</strong> Tailwind CSS, shadcn</p>
                <p><strong>Data:</strong> TanStack Query</p>
                <p><strong>Backend:</strong> Go, Redis, PostgreSQL</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400">© 2025 Vibeshift. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
