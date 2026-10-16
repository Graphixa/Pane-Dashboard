package media

import (
	"bytes"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"math"
	"os"
	"path/filepath"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// OpenPoster returns a bounded JPEG thumbnail for a committed asset.
// Images are derived lazily; videos only serve a client-uploaded still.
// Never fetch remote URLs or decode video on the server.
func (m *MediaStore) OpenPoster(id string) (*os.File, error) {
	m.thumbMu.Lock()
	defer m.thumbMu.Unlock()
	original, meta, err := m.OpenAsset(id)
	if err != nil {
		return nil, err
	}
	defer original.Close()
	target := filepath.Join(m.root, "posters", id)
	switch meta.Kind {
	case MediaKindImage:
		if cached, err := os.Open(target); err == nil {
			return cached, nil
		}
		return m.writeImagePoster(original, target)
	case MediaKindVideo:
		cached, err := os.Open(target)
		if err != nil {
			return nil, errMediaNotFound
		}
		return cached, nil
	default:
		return nil, errMediaNotFound
	}
}

func (m *MediaStore) writeImagePoster(original *os.File, target string) (*os.File, error) {
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
	if err := writePosterJPEG(target, source); err != nil {
		return nil, err
	}
	return os.Open(target)
}

// SaveVideoPoster stores a client-captured still for a committed video asset.
func (m *MediaStore) SaveVideoPoster(id string, r io.Reader, limit int64) error {
	if !validMediaID(id) {
		return errMediaInvalidID
	}
	meta, err := m.GetMeta(id)
	if err != nil {
		return err
	}
	if meta.Kind != MediaKindVideo {
		return errMediaUnsupported
	}
	// Confirm the asset file still exists beside metadata.
	asset, _, err := m.OpenAsset(id)
	if err != nil {
		return err
	}
	asset.Close()
	body, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return err
	}
	if int64(len(body)) > limit || len(body) == 0 {
		return errMediaTooLarge
	}
	source, _, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		return errMediaCorrupt
	}
	bounds := source.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w < 1 || h < 1 {
		return errMediaCorrupt
	}
	// Accept up to image max for decode, then scale to poster size.
	if w > mediaMaxImageSide || h > mediaMaxImageSide || int64(w)*int64(h) > mediaMaxImagePixels {
		return errMediaTooLarge
	}
	m.thumbMu.Lock()
	defer m.thumbMu.Unlock()
	target := filepath.Join(m.root, "posters", id)
	return writePosterJPEG(target, source)
}

func writePosterJPEG(target string, source image.Image) error {
	bounds := source.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	scale := math.Min(1, 480/float64(max(w, h)))
	thumb := image.NewRGBA(image.Rect(0, 0, max(1, int(math.Round(float64(w)*scale))), max(1, int(math.Round(float64(h)*scale)))))
	draw.ApproxBiLinear.Scale(thumb, thumb.Bounds(), source, bounds, draw.Src, nil)
	if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(target), ".poster-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if err = jpeg.Encode(tmp, thumb, &jpeg.Options{Quality: 78}); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), target)
}
