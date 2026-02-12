import { normalizeImageURL } from '@/lib/mediaUrl'

type ResponsiveImageProps = {
  variants?: Record<string, string>
  fallbackUrl?: string
  alt: string
  sizes: string
  cropMode?: string
  className?: string
  loading?: 'lazy' | 'eager'
}

const SIZES = [256, 640, 1080, 1440, 2048] as const

export function ResponsiveImage({
  variants,
  fallbackUrl,
  alt,
  sizes,
  cropMode,
  className,
  loading = 'lazy',
}: ResponsiveImageProps) {
  const aspectClass =
    cropMode === 'portrait'
      ? 'aspect-[4/5]'
      : cropMode === 'landscape'
        ? 'aspect-[1.91/1]'
        : 'aspect-square'

  const hasVariants = Boolean(variants && Object.keys(variants).length > 0)
  const normalizedFallback = normalizeImageURL(fallbackUrl)

  if (!hasVariants) {
    if (!normalizedFallback) {
      return (
        <div
          className={`relative w-full ${aspectClass} ${className ?? ''}`}
          role='img'
          aria-label={alt}
        >
          <div className='w-full h-full rounded-xl bg-muted animate-pulse' />
        </div>
      )
    }

    return (
      <div
        className={`relative w-full bg-muted overflow-hidden rounded-xl ${aspectClass}`}
      >
        <img
          src={normalizedFallback}
          alt={alt}
          className={`w-full h-full object-cover ${className ?? ''}`}
          loading={loading}
        />
      </div>
    )
  }

  const webpSrcset = SIZES.map(w =>
    variants?.[`${w}_webp`] ? `${variants[`${w}_webp`]} ${w}w` : null
  )
    .filter(Boolean)
    .join(', ')

  const jpgSrcset = SIZES.map(w =>
    variants?.[`${w}_jpg`] ? `${variants[`${w}_jpg`]} ${w}w` : null
  )
    .filter(Boolean)
    .join(', ')

  const fallbackSrc =
    variants?.['1080_jpg'] ||
    variants?.['640_jpg'] ||
    variants?.['256_jpg'] ||
    normalizeImageURL(fallbackUrl) ||
    ''

  if (!fallbackSrc) {
    return (
      <div
        className={`relative w-full ${aspectClass} ${className ?? ''}`}
        role='img'
        aria-label={alt}
      >
        <div className='w-full h-full rounded-xl bg-muted animate-pulse' />
      </div>
    )
  }

  return (
    <div
      className={`relative w-full bg-muted overflow-hidden rounded-xl ${aspectClass}`}
    >
      <picture>
        {webpSrcset ? (
          <source type='image/webp' srcSet={webpSrcset} sizes={sizes} />
        ) : null}
        <img
          src={fallbackSrc}
          srcSet={jpgSrcset || undefined}
          sizes={sizes}
          alt={alt}
          className={`w-full h-full object-cover ${className ?? ''}`}
          loading={loading}
        />
      </picture>
    </div>
  )
}
