import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '@/api/client'
import type { UpdatePostRequest } from '@/api/types'
import { PostComposerEditor } from '@/components/posts/PostComposerEditor'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { usePost, useUpdatePost } from '@/hooks/usePosts'

export default function PostEdit() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const { data: post, isLoading } = usePost(postId)
  const updatePost = useUpdatePost(postId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    if (!post) return
    setTitle(post.title ?? '')
    setContent(post.content ?? '')
    setLinkUrl(post.link_url ?? '')
    setYoutubeUrl(post.youtube_url ?? '')
    setImagePreview(post.image_url ?? '')
  }, [post])

  useEffect(() => {
    if (!newImageFile) return
    const url = URL.createObjectURL(newImageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [newImageFile])

  if (!postId || isLoading) {
    return (
      <div className='flex justify-center py-10'>
        <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!post) {
    return <div className='p-6'>Post not found.</div>
  }

  const handleSave = async () => {
    try {
      let uploadedImageURL: string | undefined
      if (newImageFile) {
        const uploaded = await apiClient.uploadImage(newImageFile)
        uploadedImageURL = uploaded.url
      }

      const payload: UpdatePostRequest = {
        content: content ?? '',
      }
      if (title.trim()) payload.title = title.trim()
      if (uploadedImageURL) payload.image_url = uploadedImageURL
      if (post.post_type === 'link') payload.link_url = linkUrl || undefined
      if (post.post_type === 'video')
        payload.youtube_url = youtubeUrl || undefined

      await updatePost.mutateAsync(payload)
      navigate(`/posts/${post.id}`)
    } catch (err) {
      console.error('Failed to save post:', err)
    }
  }

  return (
    <div className='flex-1 overflow-y-auto py-8'>
      <div className='max-w-3xl mx-auto px-4'>
        <h2 className='mb-4 text-lg font-semibold'>Edit Post</h2>
        <Card className='border bg-card/95 shadow-sm rounded-2xl overflow-hidden'>
          <CardContent className='p-5 space-y-4'>
            {post.post_type === 'text' && (
              <input
                type='text'
                placeholder='Title (optional)'
                value={title}
                onChange={e => setTitle(e.target.value)}
                className='w-full text-sm font-semibold bg-muted/30 px-4 py-2 rounded-xl focus:outline-none'
              />
            )}

            <PostComposerEditor
              value={content}
              onChange={setContent}
              minRows={6}
            />

            {post.post_type === 'media' && (
              <div className='space-y-2'>
                <input
                  type='file'
                  accept='image/*'
                  onChange={e =>
                    setNewImageFile(
                      e.target.files?.[0] ? e.target.files[0] : null
                    )
                  }
                  className='w-full text-sm'
                />
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt='Preview'
                    className='max-h-56 w-auto rounded-xl border border-border object-contain'
                  />
                )}
              </div>
            )}

            {post.post_type === 'link' && (
              <input
                type='url'
                placeholder='Link URL'
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                className='w-full text-sm bg-muted/30 px-4 py-2 rounded-xl focus:outline-none'
              />
            )}

            {post.post_type === 'video' && (
              <input
                type='url'
                placeholder='YouTube URL'
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                className='w-full text-sm bg-muted/30 px-4 py-2 rounded-xl focus:outline-none'
              />
            )}

            {post.post_type === 'poll' && (
              <div className='text-sm text-muted-foreground'>
                Editing polls is not supported in this editor.
              </div>
            )}

            <div className='flex justify-end gap-2'>
              <Button variant='ghost' onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updatePost.isLoading}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
