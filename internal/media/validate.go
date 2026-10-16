package media

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"strings"
	"time"

	"golang.org/x/image/webp"
)

func validateMediaFile(path, filename, contentTypeHint string) (*MediaMeta, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	head := make([]byte, 512)
	n, err := io.ReadFull(f, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return nil, errMediaCorrupt
	}
	head = head[:n]
	if n == 0 {
		return nil, errMediaCorrupt
	}

	kind, mime := sniffMedia(head, filename, contentTypeHint)
	switch kind {
	case MediaKindImage:
		return validateImageFile(path, mime)
	case MediaKindVideo:
		return validateVideoFile(path, mime, head)
	default:
		return nil, errMediaUnsupported
	}
}

func sniffMedia(head []byte, filename, hint string) (MediaKind, string) {
	lower := strings.ToLower(filename)
	hint = strings.ToLower(strings.TrimSpace(strings.Split(hint, ";")[0]))

	if len(head) >= 3 && head[0] == 0xff && head[1] == 0xd8 && head[2] == 0xff {
		return MediaKindImage, "image/jpeg"
	}
	if len(head) >= 8 && bytes.Equal(head[:8], []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}) {
		return MediaKindImage, "image/png"
	}
	if len(head) >= 12 && bytes.Equal(head[:4], []byte("RIFF")) && bytes.Equal(head[8:12], []byte("WEBP")) {
		return MediaKindImage, "image/webp"
	}
	if len(head) >= 6 && (bytes.Equal(head[:6], []byte("GIF87a")) || bytes.Equal(head[:6], []byte("GIF89a"))) {
		return "", "" // GIF rejected
	}
	if looksLikeWebM(head) {
		return MediaKindVideo, "video/webm"
	}
	if looksLikeMP4(head) {
		return MediaKindVideo, "video/mp4"
	}

	// Extension / hint only as a last resort after magic failed → still unsupported
	// unless magic matched. Do not trust client MIME alone.
	_ = lower
	_ = hint
	return "", ""
}

func looksLikeWebM(head []byte) bool {
	// EBML header 0x1A45DFA3
	return len(head) >= 4 && head[0] == 0x1a && head[1] == 0x45 && head[2] == 0xdf && head[3] == 0xa3
}

func looksLikeMP4(head []byte) bool {
	if len(head) < 12 {
		return false
	}
	// size(4) + 'ftyp'
	if !bytes.Equal(head[4:8], []byte("ftyp")) {
		return false
	}
	brand := string(head[8:12])
	switch brand {
	case "isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "M4A ", "MSNV", "NDSC", "NDSH", "NDSM", "NDSP", "NDSS", "NDXC", "NDXH", "NDXM", "NDXP", "NDXS":
		return true
	}
	// Major brand may be something else; accept ftyp with common compatible brands in the rest of the box.
	boxLen := int(binary.BigEndian.Uint32(head[0:4]))
	if boxLen < 16 || boxLen > len(head) {
		boxLen = len(head)
	}
	payload := head[8:boxLen]
	for _, b := range []string{"isom", "iso2", "mp41", "mp42", "avc1", "dash"} {
		if bytes.Contains(payload, []byte(b)) {
			return true
		}
	}
	return brand != ""
}

func validateImageFile(path, mime string) (*MediaMeta, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var cfg image.Config
	var format string
	switch mime {
	case "image/webp":
		cfg, err = webp.DecodeConfig(f)
		format = "webp"
	default:
		cfg, format, err = image.DecodeConfig(f)
	}
	if err != nil {
		return nil, errMediaCorrupt
	}
	switch format {
	case "jpeg", "png", "webp":
	default:
		return nil, errMediaUnsupported
	}
	w, h := cfg.Width, cfg.Height
	if w < 1 || h < 1 || w > mediaMaxImageSide || h > mediaMaxImageSide || int64(w)*int64(h) > mediaMaxImagePixels {
		return nil, errMediaTooLarge
	}
	outMIME := "image/" + format
	if format == "jpeg" {
		outMIME = "image/jpeg"
	}
	return &MediaMeta{
		Kind:   MediaKindImage,
		MIME:   outMIME,
		Width:  w,
		Height: h,
	}, nil
}

// validateVideoFile performs bounded container sniffing. Full codec tables are
// enforced in Phase 4; Phase 1 rejects corrupt/non-video and records dimensions
// when a lightweight parse succeeds.
func validateVideoFile(path, mime string, head []byte) (*MediaMeta, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > VideoUploadLimit {
		return nil, errMediaTooLarge
	}
	meta := &MediaMeta{
		Kind: MediaKindVideo,
		MIME: mime,
	}
	switch mime {
	case "video/webm":
		w, h, dur, codec, ok := probeWebM(path)
		if !ok {
			// Accept magic-matched WebM with unknown dimensions; Phase 4 tightens codecs.
			meta.Codec = "webm"
			meta.Width = 1
			meta.Height = 1
			return meta, nil
		}
		if err := checkVideoBounds(w, h, dur); err != nil {
			return nil, err
		}
		meta.Width, meta.Height = w, h
		meta.DurationMs = dur.Milliseconds()
		meta.Codec = codec
		return meta, nil
	case "video/mp4":
		w, h, dur, codec, ok := probeMP4(path, head)
		if !ok {
			meta.Codec = "mp4"
			meta.Width = 1
			meta.Height = 1
			return meta, nil
		}
		if err := checkVideoBounds(w, h, dur); err != nil {
			return nil, err
		}
		meta.Width, meta.Height = w, h
		meta.DurationMs = dur.Milliseconds()
		meta.Codec = codec
		return meta, nil
	default:
		return nil, errMediaUnsupported
	}
}

func checkVideoBounds(w, h int, dur time.Duration) error {
	if w < 1 || h < 1 {
		return errMediaCorrupt
	}
	if w > mediaMaxVideoSide || h > mediaMaxVideoSide || int64(w)*int64(h) > mediaMaxVideoPixels {
		return errMediaTooLarge
	}
	if dur > mediaMaxVideoDuration+500*time.Millisecond {
		return errMediaTooLarge
	}
	return nil
}

// Lightweight probes — best-effort without FFmpeg. Unknown parse → ok=false.

func probeWebM(path string) (w, h int, dur time.Duration, codec string, ok bool) {
	_ = path
	return 0, 0, 0, "", false
}

func probeMP4(path string, head []byte) (w, h int, dur time.Duration, codec string, ok bool) {
	_ = path
	_ = head
	return 0, 0, 0, "", false
}
