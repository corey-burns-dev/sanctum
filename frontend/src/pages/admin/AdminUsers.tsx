import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminUsers } from '@/hooks/useAdminModeration'

export default function AdminUsers() {
  const [query, setQuery] = useState('')
  const normalizedQuery = useMemo(() => query.trim(), [query])

  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useAdminUsers({
    q: normalizedQuery || undefined,
    limit: 200,
  })

  return (
    <div className='space-y-4'>
      <header>
        <h1 className='text-2xl font-bold'>Users</h1>
        <p className='text-sm text-muted-foreground'>
          Directory with moderation state and quick access to user detail.
        </p>
      </header>

      <Input
        value={query}
        onChange={event => setQuery(event.target.value)}
        className='max-w-md'
        placeholder='Search username or email'
      />

      {isLoading && (
        <p className='text-sm text-muted-foreground'>Loading users…</p>
      )}
      {isError && (
        <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3'>
          <p className='text-sm text-destructive'>Failed to load users.</p>
          <Button
            size='sm'
            className='mt-2'
            variant='outline'
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className='overflow-hidden rounded-xl border border-border/70'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-3 py-2 font-semibold'>ID</th>
                <th className='px-3 py-2 font-semibold'>Username</th>
                <th className='px-3 py-2 font-semibold'>Email</th>
                <th className='px-3 py-2 font-semibold'>State</th>
                <th className='px-3 py-2 font-semibold'>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className='border-t border-border/60'>
                  <td className='px-3 py-2'>#{user.id}</td>
                  <td className='px-3 py-2 font-medium'>{user.username}</td>
                  <td className='px-3 py-2 text-muted-foreground'>
                    {user.email}
                  </td>
                  <td className='px-3 py-2'>
                    {user.is_banned ? (
                      <Badge variant='destructive'>Banned</Badge>
                    ) : (
                      <Badge variant='outline'>Active</Badge>
                    )}
                  </td>
                  <td className='px-3 py-2'>
                    <Button asChild size='sm' variant='outline'>
                      <Link to={`/admin/users/${user.id}`}>View user</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
