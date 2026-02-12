import { getYouTubeEmbedUrl } from '@/lib/youtube'

export function YouTubeEmbed({ url }: { url: string }) {
  const embedUrl = getYouTubeEmbedUrl(url)
  if (!embedUrl) return null

  return (
    <div className='relative w-full aspect-video rounded-xl overflow-hidden bg-muted'>
      <iframe
        src={embedUrl}
        title='YouTube video'
        className='absolute inset-0 w-full h-full'
        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        allowFullScreen
      />
    </div>
  )
}
