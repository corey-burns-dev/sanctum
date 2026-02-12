import { ExternalLink } from 'lucide-react'

export function LinkCard({
  url,
  title,
  onClick,
}: {
  url: string
  title?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const displayUrl = url.length > 50 ? `${url.slice(0, 47)}...` : url

  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      onClick={e => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className='flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors text-left'
    >
      <ExternalLink className='w-5 h-5 shrink-0 text-muted-foreground' />
      <div className='min-w-0 flex-1'>
        {title ? <p className='font-medium text-sm truncate'>{title}</p> : null}
        <p className='text-xs text-muted-foreground truncate'>{displayUrl}</p>
      </div>
    </a>
  )
}
