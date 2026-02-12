import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be less than 20 characters')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers, and underscores'
      ),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

// Post schemas
const postTypeEnum = z.enum(['text', 'media', 'video', 'link', 'poll'])

const createPostPollSchema = z.object({
  question: z.string().min(1, 'Poll question is required'),
  options: z
    .array(z.string().min(1, 'Option cannot be empty'))
    .min(2, 'Poll must have at least two options'),
})

export const createPostSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(255, 'Title must be less than 255 characters'),
    content: z.string().max(5000).optional(),
    image_url: z
      .string()
      .url('Please enter a valid URL')
      .optional()
      .or(z.literal('')),
    post_type: postTypeEnum.optional().default('text'),
    link_url: z.string().url().optional().or(z.literal('')),
    youtube_url: z.string().optional(),
    poll: createPostPollSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const type = data.post_type ?? 'text'
    if (type === 'text') {
      if (!data.content?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Content is required',
          path: ['content'],
        })
      }
    }
    if (type === 'media') {
      if (!data.image_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Image is required for media posts',
          path: ['image_url'],
        })
      }
    }
    if (type === 'video') {
      if (!data.youtube_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'YouTube URL is required for video posts',
          path: ['youtube_url'],
        })
      }
    }
    if (type === 'link') {
      if (!data.link_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Link URL is required for link posts',
          path: ['link_url'],
        })
      }
    }
    if (type === 'poll') {
      if (!data.poll?.question?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Poll question is required',
          path: ['poll', 'question'],
        })
      }
      if (
        !data.poll?.options?.length ||
        data.poll.options.filter(Boolean).length < 2
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Poll must have at least two options',
          path: ['poll', 'options'],
        })
      }
    }
  })

// Comment schemas
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment must be less than 1000 characters'),
})

// Profile schemas
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    )
    .optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  avatar: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),
})

// Chat schemas
export const createConversationSchema = z.object({
  participant_ids: z
    .array(z.number())
    .min(1, 'At least one participant is required'),
  is_group: z.boolean().optional(),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
})

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters'),
  message_type: z.enum(['text', 'image', 'file']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// Search schemas
export const searchParamsSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  offset: z.number().min(0).optional(),
  limit: z.number().min(1).max(100).optional(),
})

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type CreatePostFormData = z.infer<typeof createPostSchema>
export type CreateCommentFormData = z.infer<typeof createCommentSchema>
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
export type CreateConversationFormData = z.infer<
  typeof createConversationSchema
>
export type SendMessageFormData = z.infer<typeof sendMessageSchema>
export type SearchParamsData = z.infer<typeof searchParamsSchema>
