import { useHealth } from '@/hooks/useHealth'
import { Button } from './Button'

export function StatusCard() {
  const { data, isLoading, error, refetch } = useHealth()

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Backend Health</h3>

      <div className="mb-4">
        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-gray-600">Checking...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-red-600">Offline</span>
          </div>
        )}

        {data && !error && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-green-600">Online</span>
          </div>
        )}
      </div>

      {data && (
        <div className="bg-gray-50 rounded p-3 mb-4 max-h-48 overflow-auto">
          <pre className="text-xs text-gray-700 font-mono">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      <Button onClick={() => refetch()} disabled={isLoading} className="w-full">
        {isLoading ? 'Checking...' : 'Refresh Status'}
      </Button>
    </div>
  )
}
