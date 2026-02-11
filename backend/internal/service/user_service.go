package service

import (
	"context"

	"sanctum/internal/models"
	"sanctum/internal/repository"
)

type UserService struct {
	userRepo repository.UserRepository
}

type UpdateProfileInput struct {
	UserID   uint
	Username string
	Bio      string
	Avatar   string
}

func NewUserService(userRepo repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) ListUsers(ctx context.Context, limit, offset int) ([]models.User, error) {
	return s.userRepo.List(ctx, limit, offset)
}

func (s *UserService) GetUserByID(ctx context.Context, id uint) (*models.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

func (s *UserService) UpdateProfile(ctx context.Context, in UpdateProfileInput) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, in.UserID)
	if err != nil {
		return nil, err
	}

	if in.Username != "" {
		user.Username = in.Username
	}
	if in.Bio != "" {
		user.Bio = in.Bio
	}
	if in.Avatar != "" {
		user.Avatar = in.Avatar
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) SetAdmin(ctx context.Context, targetID uint, isAdmin bool) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, targetID)
	if err != nil {
		return nil, err
	}

	user.IsAdmin = isAdmin
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}
