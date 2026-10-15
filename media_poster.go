package main

import (
	"image"
	"image/jpeg"
	"math"
	"net/http"
	"os"
	"path/filepath"

	"golang.org/x/image/draw"
)

// Uploaded image thumbnails are derived once, bounded to 480px, and cached beside
// the original. Never fetch remote URLs or decode video to populate a gallery.
func (m *MediaStore) OpenImagePoster(id string) (*os.File, error) {
	m.thumbMu.Lock()
	defer m.thumbMu.Unlock()
	original, meta, err := m.OpenAsset(id)
	if err != nil {
		return nil, err
	}
	defer original.Close()
	if meta.Kind != MediaKindImage {
		return nil, errMediaNotFound
	}
	target := filepath.Join(m.root, "posters", id)
	if cached, err := os.Open(target); err == nil {
		return cached, nil
	}
	config, _, err := image.DecodeConfig(original)
	if err != nil {
		return nil, errMediaCorrupt
	}
	if config.Width < 1 || config.Height < 1 || config.Width > mediaMaxImageSide || config.Height > mediaMaxImageSide || int64(config.Width)*int64(config.Height) > mediaMaxImagePixels {
		return nil, errMediaTooLarge
	}
	if _, err = original.Seek(0, 0); err != nil {
		return nil, err
	}
	source, _, err := image.Decode(original)
	if err != nil {
		return nil, errMediaCorrupt
	}
	scale := math.Min(1, 480/float64(max(config.Width, config.Height)))
	thumb := image.NewRGBA(image.Rect(0, 0, max(1, int(math.Round(float64(config.Width)*scale))), max(1, int(math.Round(float64(config.Height)*scale)))))
	draw.ApproxBiLinear.Scale(thumb, thumb.Bounds(), source, source.Bounds(), draw.Src, nil)
	tmp, err := os.CreateTemp(filepath.Dir(target), ".poster-*")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmp.Name())
	if err = jpeg.Encode(tmp, thumb, &jpeg.Options{Quality: 78}); err != nil {
		tmp.Close()
		return nil, err
	}
	if err = tmp.Close(); err != nil {
		return nil, err
	}
	if err = os.Rename(tmp.Name(), target); err != nil {
		return nil, err
	}
	return os.Open(target)
}

func serveMediaPoster(w http.ResponseWriter, r *http.Request, media *MediaStore) {
	file, err := media.OpenImagePoster(r.PathValue("id"))
	if err != nil {
		w.Header().Set("Cache-Control", "private, no-store")
		status, message := mediaErrorStatus(err)
		apiError(w, status, message)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		apiError(w, 500, "Could not read thumbnail.")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", `"poster-v1-`+r.PathValue("id")+`"`)
	http.ServeContent(w, r, "thumbnail.jpg", info.ModTime(), file)
}
