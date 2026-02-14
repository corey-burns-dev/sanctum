package service

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
	"time"

	"sanctum/internal/config"
	"sanctum/internal/models"
	"sanctum/internal/repository"

	"gorm.io/gorm"
)

type imageRepoStub struct {
	items  map[string]*models.Image
	nextID uint
}

func newImageRepoStub() *imageRepoStub {
	return &imageRepoStub{items: make(map[string]*models.Image), nextID: 1}
}

func (s *imageRepoStub) Create(_ context.Context, image *models.Image) error {
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

func (s *imageRepoStub) GetByHash(_ context.Context, hash string) (*models.Image, error) {
	item, ok := s.items[hash]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return item, nil
}

func (s *imageRepoStub) GetByHashWithVariants(ctx context.Context, hash string) (*models.Image, error) {
	return s.GetByHash(ctx, hash)
}

func (s *imageRepoStub) UpdateLastAccessed(_ context.Context, id uint) error {
	for _, item := range s.items {
		if item.ID == id {
			now := time.Now().UTC()
			item.LastAccessedAt = &now
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoStub) UpsertVariant(_ context.Context, v *models.ImageVariant) error {
	for _, item := range s.items {
		if item.ID == v.ImageID {
			item.Variants = append(item.Variants, *v)
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoStub) GetVariantsByImageID(_ context.Context, imageID uint) ([]models.ImageVariant, error) {
	for _, item := range s.items {
		if item.ID == imageID {
			return item.Variants, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (s *imageRepoStub) ClaimNextQueued(_ context.Context) (*models.Image, error) {
	for _, item := range s.items {
		if item.Status == repository.ImageStatusQueued {
			item.Status = repository.ImageStatusProcessing
			return item, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (s *imageRepoStub) MarkReady(_ context.Context, imageID uint) error {
	for _, item := range s.items {
		if item.ID == imageID {
			item.Status = repository.ImageStatusReady
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoStub) MarkFailed(_ context.Context, imageID uint, errMsg string) error {
	for _, item := range s.items {
		if item.ID == imageID {
			item.Status = repository.ImageStatusFailed
			item.Error = errMsg
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (s *imageRepoStub) RequeueStaleProcessing(_ context.Context, _ time.Duration) (int64, error) {
	return 0, nil
}

func TestImageServiceUploadAndResolve(t *testing.T) {
	repo := newImageRepoStub()
	cfg := &config.Config{ImageUploadDir: t.TempDir(), ImageMaxUploadSizeMB: 1}
	svc := NewImageService(repo, cfg)

	content := tinyPNG(t, 1200, 800)
	img, err := svc.Upload(context.Background(), UploadImageInput{
		UserID:      42,
		Filename:    "avatar.png",
		ContentType: "image/png",
		Content:     content,
	})
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if img.ID == 0 || img.Hash == "" {
		t.Fatalf("expected persisted image metadata, got %+v", img)
	}

	for _, rel := range []string{
		filepath.ToSlash(filepath.Join(img.Hash, "master.jpg")),
		filepath.ToSlash(filepath.Join(img.Hash, "master.webp")),
	} {
		path := cfg.ImageUploadDir + "/" + rel
		if _, statErr := os.Stat(path); statErr != nil {
			t.Fatalf("expected file at %s: %v", path, statErr)
		}
	}

	// Same content by same user should dedupe.
	img2, err := svc.Upload(context.Background(), UploadImageInput{
		UserID:      42,
		Filename:    "avatar-copy.png",
		ContentType: "image/png",
		Content:     content,
	})
	if err != nil {
		t.Fatalf("dedupe upload failed: %v", err)
	}
	if img2.ID != img.ID {
		t.Fatalf("expected deduped record id %d, got %d", img.ID, img2.ID)
	}

	_, fullPath, err := svc.ResolveForServing(context.Background(), img.Hash, ImageSizeThumbnail)
	if err != nil {
		t.Fatalf("resolve thumbnail failed: %v", err)
	}
	if _, statErr := os.Stat(fullPath); statErr != nil {
		t.Fatalf("expected resolved file to exist: %v", statErr)
	}
}

func TestImageServiceNormalizesResolutionAndCompressesOpaqueUploads(t *testing.T) {
	repo := newImageRepoStub()
	cfg := &config.Config{ImageUploadDir: t.TempDir(), ImageMaxUploadSizeMB: 10}
	svc := NewImageService(repo, cfg)

	content := noisyPNG(t, 1600, 1200)
	img, err := svc.Upload(context.Background(), UploadImageInput{
		UserID:      9,
		Filename:    "large.png",
		ContentType: "image/png",
		Content:     content,
	})
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if img.Width > OriginalMaxSize || img.Height > OriginalMaxSize {
		t.Fatalf("expected normalized dimensions <= %d, got %dx%d", OriginalMaxSize, img.Width, img.Height)
	}
	if img.MimeType != "image/jpeg" {
		t.Fatalf("expected opaque image normalized to jpeg, got %s", img.MimeType)
	}
	if ext := filepath.Ext(img.OriginalPath); ext != ".jpg" {
		t.Fatalf("expected .jpg normalized original path, got %q", img.OriginalPath)
	}
	if img.SizeBytes >= int64(len(content)) {
		t.Fatalf("expected compressed upload smaller than source (%d >= %d)", img.SizeBytes, len(content))
	}
}

func TestImageServiceNormalizesTransparencyToJPEG(t *testing.T) {
	repo := newImageRepoStub()
	cfg := &config.Config{ImageUploadDir: t.TempDir(), ImageMaxUploadSizeMB: 10}
	svc := NewImageService(repo, cfg)

	content := transparentPNG(t, 64, 64)
	img, err := svc.Upload(context.Background(), UploadImageInput{
		UserID:      11,
		Filename:    "alpha.png",
		ContentType: "image/png",
		Content:     content,
	})
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if img.MimeType != "image/jpeg" {
		t.Fatalf("expected transparent image to normalize to jpeg, got %s", img.MimeType)
	}
	if ext := filepath.Ext(img.OriginalPath); ext != ".jpg" {
		t.Fatalf("expected .jpg normalized original path, got %q", img.OriginalPath)
	}
}

func TestImageServiceUploadValidation(t *testing.T) {
	repo := newImageRepoStub()
	cfg := &config.Config{ImageUploadDir: t.TempDir(), ImageMaxUploadSizeMB: 1}
	svc := NewImageService(repo, cfg)

	_, err := svc.Upload(context.Background(), UploadImageInput{
		UserID:      1,
		Filename:    "bad.txt",
		ContentType: "text/plain",
		Content:     []byte("not an image"),
	})
	if err == nil {
		t.Fatal("expected invalid image error")
	}

	tooLarge := bytes.Repeat([]byte{'a'}, 2*1024*1024)
	_, err = svc.Upload(context.Background(), UploadImageInput{
		UserID:      1,
		Filename:    "huge.png",
		ContentType: "image/png",
		Content:     tooLarge,
	})
	if err == nil {
		t.Fatal("expected size validation error")
	}
}

func TestBuildImageURLIsRelative(t *testing.T) {
	svc := NewImageService(nil, nil)

	original := svc.BuildImageURL("abc123", ImageSizeOriginal)
	if original != "/api/images/abc123" {
		t.Fatalf("expected relative original URL, got %q", original)
	}

	thumbnail := svc.BuildImageURL("abc123", ImageSizeThumbnail)
	if thumbnail != "/api/images/abc123?size=thumbnail" {
		t.Fatalf("expected relative thumbnail URL, got %q", thumbnail)
	}
}

func tinyPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	buf := bytes.NewBuffer(nil)
	if err := png.Encode(buf, img); err != nil {
		t.Fatalf("encode tiny png: %v", err)
	}
	return buf.Bytes()
}

func noisyPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	src := rand.NewSource(42)
	// #nosec G404: weak random is fine for test image generation
	rng := rand.New(src)
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, color.RGBA{
				// #nosec G115: Intn(256) is safe for uint8
				R: uint8(rng.Intn(256)),
				// #nosec G115
				G: uint8(rng.Intn(256)),
				// #nosec G115
				B: uint8(rng.Intn(256)),
				A: 255,
			})
		}
	}
	buf := bytes.NewBuffer(nil)
	if err := png.Encode(buf, img); err != nil {
		t.Fatalf("encode noisy png: %v", err)
	}
	return buf.Bytes()
}

func transparentPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			// #nosec G115: modulo 255 is safe for uint8
			img.SetRGBA(x, y, color.RGBA{R: 255, G: 0, B: 0, A: uint8((x + y) % 255)})
		}
	}
	buf := bytes.NewBuffer(nil)
	if err := png.Encode(buf, img); err != nil {
		t.Fatalf("encode transparent png: %v", err)
	}
	return buf.Bytes()
}
