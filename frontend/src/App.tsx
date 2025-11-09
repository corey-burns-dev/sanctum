import { useHealth } from './hooks/useHealth'

export default function App() {
  const { data, isLoading, refetch } = useHealth()

  return (
    <div className="app p-8 mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Vibeshift</h1>
      <button
        onClick={() => refetch()}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60 mb-4"
      >
        {isLoading ? 'Loading...' : 'Refresh'}
      </button>

      <div className="bg-gray-100 p-4 rounded">
        <pre className="text-sm">{isLoading ? 'Loading...' : JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  )
}
