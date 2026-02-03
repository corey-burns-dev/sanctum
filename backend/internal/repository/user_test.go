package repository

import (
	"context"
	"regexp"
	"testing"
	"vibeshift/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	gormDB, err := gorm.Open(postgres.New(postgres.Config{
		Conn: db,
	}), &gorm.Config{})
	require.NoError(t, err)

	return gormDB, mock
}

func TestUserRepository_GetByID(t *testing.T) {
	db, mock := setupMockDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	tests := []struct {
		name          string
		userID        uint
		mockBehavior  func()
		expectedUser  *models.User
		expectedError bool
	}{
		{
			name:   "Success",
			userID: 1,
			mockBehavior: func() {
				rows := sqlmock.NewRows([]string{"id", "username", "email"}).
					AddRow(1, "testuser", "test@example.com")
				mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "users" WHERE "users"."id" = $1 AND "users"."deleted_at" IS NULL ORDER BY "users"."id" LIMIT $2`)).
					WithArgs(1, 1).
					WillReturnRows(rows)
			},
			expectedUser: &models.User{ID: 1, Username: "testuser", Email: "test@example.com"},
		},
		{
			name:   "Not Found",
			userID: 99,
			mockBehavior: func() {
				mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "users" WHERE "users"."id" = $1 AND "users"."deleted_at" IS NULL ORDER BY "users"."id" LIMIT $2`)).
					WithArgs(99, 1).
					WillReturnError(gorm.ErrRecordNotFound)
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockBehavior()
			user, err := repo.GetByID(ctx, tt.userID)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedUser.Username, user.Username)
			}
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestUserRepository_Create(t *testing.T) {
	db, mock := setupMockDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	user := &models.User{Username: "newuser", Email: "new@example.com"}

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO "users"`)).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(ctx, user)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}
