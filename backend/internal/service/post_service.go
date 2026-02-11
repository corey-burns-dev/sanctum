package service

import (
	"context"

	"sanctum/internal/models"
	"sanctum/internal/repository"
)

type PostService struct {
	postRepo repository.PostRepository
	isAdmin  func(ctx context.Context, userID uint) (bool, error)
}

type CreatePostInput struct {
	UserID    uint
	Title     string
	Content   string
	ImageURL  string
	SanctumID *uint
}

type ListPostsInput struct {
	Limit         int
	Offset        int
	CurrentUserID uint
	SanctumID     *uint
}

type UpdatePostInput struct {
	UserID   uint
	PostID   uint
	Title    string
	Content  string
	ImageURL string
}

type DeletePostInput struct {
	UserID uint
	PostID uint
}

func NewPostService(
	postRepo repository.PostRepository,
	isAdmin func(ctx context.Context, userID uint) (bool, error),
) *PostService {
	return &PostService{
		postRepo: postRepo,
		isAdmin:  isAdmin,
	}
}

func (s *PostService) SearchPosts(ctx context.Context, query string, limit, offset int, currentUserID uint) ([]*models.Post, error) {
	if query == "" {
		return nil, models.NewValidationError("Search query is required")
	}
	return s.postRepo.Search(ctx, query, limit, offset, currentUserID)
}

func (s *PostService) CreatePost(ctx context.Context, in CreatePostInput) (*models.Post, error) {
	if in.Title == "" || in.Content == "" {
		return nil, models.NewValidationError("Title and content are required")
	}

	post := &models.Post{
		Title:     in.Title,
		Content:   in.Content,
		ImageURL:  in.ImageURL,
		UserID:    in.UserID,
		SanctumID: in.SanctumID,
	}
	if err := s.postRepo.Create(ctx, post); err != nil {
		return nil, err
	}

	return s.postRepo.GetByID(ctx, post.ID, in.UserID)
}

func (s *PostService) ListPosts(ctx context.Context, in ListPostsInput) ([]*models.Post, error) {
	if in.SanctumID != nil {
		return s.postRepo.GetBySanctumID(ctx, *in.SanctumID, in.Limit, in.Offset, in.CurrentUserID)
	}
	return s.postRepo.List(ctx, in.Limit, in.Offset, in.CurrentUserID)
}

func (s *PostService) GetPost(ctx context.Context, id uint, currentUserID uint) (*models.Post, error) {
	return s.postRepo.GetByID(ctx, id, currentUserID)
}

func (s *PostService) GetUserPosts(ctx context.Context, userID uint, limit, offset int, currentUserID uint) ([]*models.Post, error) {
	return s.postRepo.GetByUserID(ctx, userID, limit, offset, currentUserID)
}

func (s *PostService) UpdatePost(ctx context.Context, in UpdatePostInput) (*models.Post, error) {
	post, err := s.postRepo.GetByID(ctx, in.PostID, in.UserID)
	if err != nil {
		return nil, err
	}

	if post.UserID != in.UserID {
		return nil, models.NewUnauthorizedError("You can only update your own posts")
	}

	if in.Title != "" {
		post.Title = in.Title
	}
	if in.Content != "" {
		post.Content = in.Content
	}
	if in.ImageURL != "" {
		post.ImageURL = in.ImageURL
	}

	if err := s.postRepo.Update(ctx, post); err != nil {
		return nil, err
	}
	return post, nil
}

func (s *PostService) DeletePost(ctx context.Context, in DeletePostInput) error {
	post, err := s.postRepo.GetByID(ctx, in.PostID, in.UserID)
	if err != nil {
		return err
	}

	if post.UserID != in.UserID {
		if s.isAdmin == nil {
			return models.NewUnauthorizedError("You can only delete your own posts")
		}
		admin, err := s.isAdmin(ctx, in.UserID)
		if err != nil {
			return err
		}
		if !admin {
			return models.NewUnauthorizedError("You can only delete your own posts")
		}
	}

	return s.postRepo.Delete(ctx, in.PostID)
}

func (s *PostService) ToggleLike(ctx context.Context, userID, postID uint) (*models.Post, error) {
	isLiked, err := s.postRepo.IsLiked(ctx, userID, postID)
	if err != nil {
		return nil, err
	}

	if isLiked {
		if err := s.postRepo.Unlike(ctx, userID, postID); err != nil {
			return nil, err
		}
	} else {
		if err := s.postRepo.Like(ctx, userID, postID); err != nil {
			return nil, err
		}
	}

	return s.postRepo.GetByID(ctx, postID, userID)
}

func (s *PostService) UnlikePost(ctx context.Context, userID, postID uint) (*models.Post, error) {
	if err := s.postRepo.Unlike(ctx, userID, postID); err != nil {
		return nil, err
	}
	return s.postRepo.GetByID(ctx, postID, userID)
}
