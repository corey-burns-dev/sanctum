package validation

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidatePassword(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{"Valid", "SecurePass12!@", false},
		{"Too Short", "Small1!", true},
		{"No Upper", "securepass12!", true},
		{"No Lower", "SECUREPASS12!", true},
		{"No Digit", "SecurePass!!", true},
		{"No Special", "SecurePass123", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.password)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateUsername(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		username string
		wantErr  bool
	}{
		{"Valid", "test_user123", false},
		{"Too Short", "tu", true},
		{"Illegal Chars", "user@123", true},
		{"Starts Dash", "-user", true},
		{"Ends Underscore", "user_", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateUsername(tt.username)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateEmail(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		email   string
		wantErr bool
	}{
		{"Valid", "test@example.com", false},
		{"Invalid Format", "not-an-email", true},
		{"Missing Domain", "user@", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEmail(tt.email)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
