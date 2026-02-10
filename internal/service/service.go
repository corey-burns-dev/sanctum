package service

import (
	"context"
)

// UserService defines business operations related to users.
type UserService interface {
	GetProfile(ctx context.Context, userID uint64) (*UserProfile, error)
}

// UserProfile is a lightweight DTO returned by UserService.
type UserProfile struct {
	ID          uint64
	Username    string
	DisplayName string
	Bio         string
}

type userService struct {
	// Add repository dependencies here, for example:
	// repo repository.UserRepository
}

// NewUserService constructs a UserService. Pass repository implementations here.
func NewUserService( /*repo repository.UserRepository*/ ) UserService {
	return &userService{}
}

func (s *userService) GetProfile(ctx context.Context, userID uint64) (*UserProfile, error) {
	// TODO: implement using repository and business rules
	return &UserProfile{ID: userID, Username: "(placeholder)"}, nil
}
