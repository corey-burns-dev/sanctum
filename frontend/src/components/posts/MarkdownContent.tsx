import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

const markdownComponents = {
  p: ({ children }) => <p className='my-1'>{children}</p>,
  strong: ({ children }) => <strong className='font-bold'>{children}</strong>,
  em: ({ children }) => <em className='italic'>{children}</em>,
  ul: ({ children }) => <ul className='list-disc pl-5 my-1'>{children}</ul>,
  ol: ({ children }) => <ol className='list-decimal pl-5 my-1'>{children}</ol>,
  li: ({ children }) => <li className='my-0.5'>{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='text-primary underline underline-offset-2'
    >
      {children}
    </a>
  ),
}

export function MarkdownContent({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  if (!content.trim()) return null

  return (
    <div className={cn('max-w-none break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
