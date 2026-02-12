interface AdminPlaceholderProps {
  title: string
  description: string
}

export default function AdminPlaceholder({
  title,
  description,
}: AdminPlaceholderProps) {
  return (
    <div className='space-y-3'>
      <h1 className='text-2xl font-bold'>{title}</h1>
      <p className='text-sm text-muted-foreground'>{description}</p>
      <div className='rounded-xl border border-border/70 bg-card/60 p-4 text-sm text-muted-foreground'>
        This page is scaffolded and ready for deeper controls as related backend
        endpoints are expanded.
      </div>
    </div>
  )
}
