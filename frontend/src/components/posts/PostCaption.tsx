import { useState } from 'react'
import { MarkdownContent } from './MarkdownContent'

export function PostCaption({
  title,
  content,
  username,
}: {
  title?: string
  content: string
  username?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxLength = 120
  const shouldTruncate = content.length > maxLength
  const showTruncated = shouldTruncate && !isExpanded

  return (
    <div className='space-y-1 text-sm'>
      {username && (
        <span className='font-bold mr-2 hover:underline cursor-pointer'>
          {username}
        </span>
      )}

      {title && <span className='font-bold mr-2'>{title}</span>}

      {showTruncated ? (
        <span>{content.slice(0, maxLength)}...</span>
      ) : (
        <MarkdownContent content={content} className='text-sm' />
      )}

      {shouldTruncate && (
        <button
          type='button'
          onClick={event => {
            event.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className='text-muted-foreground ml-1 hover:text-foreground font-medium'
        >
          {isExpanded ? 'less' : 'more'}
        </button>
      )}
    </div>
  )
}
