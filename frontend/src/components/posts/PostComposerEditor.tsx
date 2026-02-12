import { Bold, Italic, List, ListOrdered, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type ToolbarAction = 'bold' | 'italic' | 'bulletList' | 'numberedList'

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string
): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end)
  const newText =
    textarea.value.slice(0, start) +
    before +
    selected +
    after +
    textarea.value.slice(end)
  return newText
}

function applyAction(
  textarea: HTMLTextAreaElement,
  action: ToolbarAction
): string {
  switch (action) {
    case 'bold':
      return wrapSelection(textarea, '**', '**')
    case 'italic':
      return wrapSelection(textarea, '*', '*')
    case 'bulletList': {
      const lineStart =
        textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1
      const insertPos = lineStart
      const before = textarea.value.slice(0, insertPos)
      const after = textarea.value.slice(insertPos)
      return `${before}- ${after}`
    }
    case 'numberedList': {
      const lineStart =
        textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1
      const insertPos = lineStart
      const before = textarea.value.slice(0, insertPos)
      const after = textarea.value.slice(insertPos)
      return `${before}1. ${after}`
    }
    default:
      return textarea.value
  }
}

export function PostComposerEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  minRows = 3,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minRows?: number
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isMarkdownMode, setIsMarkdownMode] = useState(false)

  const handleToolbar = (action: ToolbarAction) => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    const newValue = applyAction(el, action)
    onChange(newValue)
    // Restore focus and selection after React re-render
    requestAnimationFrame(() => {
      el.focus()
    })
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 overflow-hidden',
        className
      )}
    >
      <div className='flex items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1 py-1'>
        <ToolbarButton
          icon={Bold}
          label='Bold'
          onClick={() => handleToolbar('bold')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={Italic}
          label='Italic'
          onClick={() => handleToolbar('italic')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={List}
          label='Bullet list'
          onClick={() => handleToolbar('bulletList')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={ListOrdered}
          label='Numbered list'
          onClick={() => handleToolbar('numberedList')}
          disabled={disabled}
        />
        <div className='ml-auto'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-xs h-7'
            onClick={() => setIsMarkdownMode(!isMarkdownMode)}
          >
            {isMarkdownMode ? 'Fancy' : 'Markdown'}
          </Button>
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'min-h-0 resize-none border-0 rounded-none focus-visible:ring-0 bg-background',
          isMarkdownMode && 'font-mono text-sm'
        )}
        rows={minRows}
      />
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='h-8 w-8 p-0'
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon className='w-4 h-4' />
    </Button>
  )
}
