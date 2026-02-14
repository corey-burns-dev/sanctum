//go:build integration

package test

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gofiber/fiber/v2"
)

type uploadResp struct {
	ID           uint   `json:"id"`
	Hash         string `json:"hash"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnail_url"`
	MediumURL    string `json:"medium_url"`
}

func TestImageUploadAndMediaPostFlow(t *testing.T) {
	app := newSanctumTestApp(t)
	user := signupSanctumUser(t, app, "imgflow")

	uploaded := uploadImage(t, app, user.Token, testPNGBytes(t))
	if uploaded.URL == "" || uploaded.Hash == "" {
		t.Fatalf("invalid upload response: %+v", uploaded)
	}

	parsedURL, err := url.Parse(uploaded.URL)
	if err != nil {
		t.Fatalf("parse uploaded URL: %v", err)
	}
	serveReq := httptest.NewRequest(http.MethodGet, parsedURL.RequestURI(), nil)
	serveResp, err := app.Test(serveReq, -1)
	if err != nil {
		t.Fatalf("serve uploaded image: %v", err)
	}
	defer func() { _ = serveResp.Body.Close() }()
	if serveResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 serving uploaded image, got %d", serveResp.StatusCode)
	}

	createBody := map[string]any{
		"title":     "Media from upload",
		"content":   "",
		"post_type": "media",
		"image_url": uploaded.URL,
	}
	createReq := authReq(t, http.MethodPost, "/api/posts/", user.Token, createBody)
	createResp, err := app.Test(createReq, -1)
	if err != nil {
		t.Fatalf("create media post: %v", err)
	}
	defer func() { _ = createResp.Body.Close() }()
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected media post create 201, got %d", createResp.StatusCode)
	}

	badUpload := uploadImageWithFilename(t, app, user.Token, []byte("not an image"), "bad.txt")
	if badUpload.status != http.StatusBadRequest {
		t.Fatalf("expected bad upload 400, got %d", badUpload.status)
	}
}

type uploadResult struct {
	payload uploadResp
	status  int
}

func uploadImage(t *testing.T, app *fiber.App, token string, content []byte) uploadResp {
	res := uploadImageWithFilename(t, app, token, content, "test.png")
	return res.payload
}

func uploadImageWithFilename(t *testing.T, app *fiber.App, token string, content []byte, filename string) uploadResult {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, writeErr := part.Write(content); writeErr != nil {
		t.Fatalf("write form file: %v", writeErr)
	}
	if closeErr := writer.Close(); closeErr != nil {
		t.Fatalf("close multipart writer: %v", closeErr)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/images/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("upload image request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	result := uploadResult{status: resp.StatusCode}
	if resp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(resp.Body).Decode(&result.payload); err != nil {
			t.Fatalf("decode upload response: %v", err)
		}
	}
	return result
}

func testPNGBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	buf := bytes.NewBuffer(nil)
	if err := png.Encode(buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}
