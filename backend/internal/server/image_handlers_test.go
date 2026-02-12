package server

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"sanctum/internal/config"
	"sanctum/internal/models"
	"sanctum/internal/repository"
	"sanctum/internal/service"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type imageRepoTestStub struct {
	items  map[string]*models.Image
	nextID uint
}

func newImageRepoTestStub() *imageRepoTestStub {
	return &imageRepoTestStub{items: make(map[string]*models.Image), nextID: 1}
}

func (s *imageRepoTestStub) Create(_ context.Context, image *models.Image) error {
	if image.ID == 0 {
		image.ID = s.nextID
		s.nextID++
	}
	now := time.Now().UTC()
	image.CreatedAt = now
	image.UpdatedAt = now
	s.items[image.Hash] = image
	return nil
}

func (s *imageRepoTestStub) GetByHash(_ context.Context, hash string) (*models.Image, error) {
	item, ok := s.items[hash]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return item, nil
}

func (s *imageRepoTestStub) UpdateLastAccessed(_ context.Context, _ uint) error { return nil }

func (s *imageRepoTestStub) GetByHashWithVariants(ctx context.Context, hash string) (*models.Image, error) {
	return s.GetByHash(ctx, hash)
}

func (s *imageRepoTestStub) UpsertVariant(_ context.Context, v *models.ImageVariant) error {
	for _, item := range s.items {
		if item.ID == v.ImageID {
			item.Variants = append(item.Variants, *v)
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoTestStub) GetVariantsByImageID(_ context.Context, imageID uint) ([]models.ImageVariant, error) {
	for _, item := range s.items {
		if item.ID == imageID {
			return item.Variants, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (s *imageRepoTestStub) ClaimNextQueued(_ context.Context) (*models.Image, error) {
	for _, item := range s.items {
		if item.Status == repository.ImageStatusQueued {
			item.Status = repository.ImageStatusProcessing
			return item, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (s *imageRepoTestStub) MarkReady(_ context.Context, imageID uint) error {
	for _, item := range s.items {
		if item.ID == imageID {
			item.Status = repository.ImageStatusReady
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoTestStub) MarkFailed(_ context.Context, imageID uint, errMsg string) error {
	for _, item := range s.items {
		if item.ID == imageID {
			item.Status = repository.ImageStatusFailed
			item.Error = errMsg
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoTestStub) RequeueStaleProcessing(_ context.Context, _ time.Duration) (int64, error) {
	return 0, nil
}

func TestUploadAndServeImage(t *testing.T) {
	cfg := &config.Config{ImageUploadDir: t.TempDir(), ImageMaxUploadSizeMB: 10}
	repo := newImageRepoTestStub()
	svc := service.NewImageService(repo, cfg)
	s := &Server{config: cfg, imageRepo: repo, imageService: svc}

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("userID", uint(1))
		return c.Next()
	})
	app.Post("/api/images/upload", s.UploadImage)
	app.Get("/api/images/:hash", s.ServeImage)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image", "img.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(makeTestPNG(t)); err != nil {
		t.Fatalf("write image bytes: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/images/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("upload request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var uploaded ImageUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&uploaded); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if uploaded.Hash == "" || uploaded.URL == "" {
		t.Fatalf("unexpected upload response: %+v", uploaded)
	}
	if !strings.HasPrefix(uploaded.URL, "/media/i/") {
		t.Fatalf("expected relative image URL, got %q", uploaded.URL)
	}

	serveReq := httptest.NewRequest(http.MethodGet, "/api/images/"+uploaded.Hash, nil)
	serveResp, err := app.Test(serveReq)
	if err != nil {
		t.Fatalf("serve request failed: %v", err)
	}
	defer func() { _ = serveResp.Body.Close() }()
	if serveResp.StatusCode != http.StatusMovedPermanently {
		t.Fatalf("expected serve 301, got %d", serveResp.StatusCode)
	}
}

func TestUploadImageMissingFile(t *testing.T) {
	cfg := &config.Config{ImageUploadDir: t.TempDir(), ImageMaxUploadSizeMB: 10}
	repo := newImageRepoTestStub()
	s := &Server{config: cfg, imageRepo: repo, imageService: service.NewImageService(repo, cfg)}

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("userID", uint(1))
		return c.Next()
	})
	app.Post("/api/images/upload", s.UploadImage)

	req := httptest.NewRequest(http.MethodPost, "/api/images/upload", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("upload request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func makeTestPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 40, 40))
	buf := bytes.NewBuffer(nil)
	if err := png.Encode(buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}
