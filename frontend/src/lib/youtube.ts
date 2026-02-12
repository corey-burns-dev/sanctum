/**
 * Extract YouTube video ID from watch or embed URL and return embed URL.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.toLowerCase()
    let videoId: string | null = null
    if (host.includes('youtube.com')) {
      videoId = u.searchParams.get('v')
    } else if (host.includes('youtu.be')) {
      videoId = u.pathname.slice(1).split('/')[0] || null
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`
    }
  } catch {
    // ignore
  }
  return null
}
