package archive

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/Graphixa/Pane-Dashboard/internal/config"
	"github.com/Graphixa/Pane-Dashboard/internal/media"
)

const (
	archiveMaxEntries = 66 // config + manifest + ≤64 media
	archiveMaxBytes   = 600 << 20
)

type archiveManifest struct {
	Version   int      `json:"version"`
	CreatedAt string   `json:"createdAt"`
	AssetIDs  []string `json:"assetIds"`
}

// ExportArchive writes a portable zip: pane.yaml, manifest.json, media/<id>.
func ExportArchive(w io.Writer, c config.Config, store *media.MediaStore) error {
	zw := zip.NewWriter(w)
	defer zw.Close()

	cfgBytes, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	if err := zipWrite(zw, "pane.yaml", cfgBytes); err != nil {
		return err
	}

	ids := map[string]struct{}{}
	if c.Appearance.Background != nil {
		ids = config.CollectAssetIDs(*c.Appearance.Background, c.Dashboard.Logo, c.Dashboard.Icon)
	} else {
		for _, ref := range []string{c.Dashboard.Logo, c.Dashboard.Icon} {
			if id, ok := config.LogoAssetID(ref); ok {
				ids[id] = struct{}{}
			}
		}
	}
	list := make([]string, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	man, _ := json.Marshal(archiveManifest{
		Version:   1,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		AssetIDs:  list,
	})
	if err := zipWrite(zw, "manifest.json", man); err != nil {
		return err
	}
	if store == nil {
		return nil
	}
	for id := range ids {
		meta, err := store.GetMeta(id)
		if err != nil {
			return fmt.Errorf("export missing asset %s", id)
		}
		data, err := store.ReadAssetBytes(id)
		if err != nil {
			return err
		}
		if err := zipWrite(zw, "media/"+id, data); err != nil {
			return err
		}
		mb, _ := json.Marshal(meta)
		if err := zipWrite(zw, "media/"+id+".json", mb); err != nil {
			return err
		}
	}
	return nil
}

func zipWrite(zw *zip.Writer, name string, data []byte) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}

// ImportArchivePreview unpacks into staging under media, returns the config for draft preview.
// Does not commit configuration.
func ImportArchivePreview(r io.ReaderAt, size int64, store *media.MediaStore) (config.Config, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return config.Config{}, fmt.Errorf("invalid archive")
	}
	if len(zr.File) > archiveMaxEntries {
		return config.Config{}, fmt.Errorf("archive has too many entries")
	}
	var total int64
	var cfgBytes []byte
	type staged struct {
		data []byte
		meta []byte
	}
	files := map[string]*staged{}
	for _, f := range zr.File {
		name := path.Clean("/" + strings.ReplaceAll(f.Name, "\\", "/"))
		name = strings.TrimPrefix(name, "/")
		if name == "" || strings.Contains(name, "..") || f.FileInfo().Mode()&os.ModeSymlink != 0 {
			return config.Config{}, fmt.Errorf("archive path not allowed")
		}
		if f.UncompressedSize64 > archiveMaxBytes {
			return config.Config{}, fmt.Errorf("archive entry too large")
		}
		total += int64(f.UncompressedSize64)
		if total > archiveMaxBytes {
			return config.Config{}, fmt.Errorf("archive exceeds size limit")
		}
		rc, err := f.Open()
		if err != nil {
			return config.Config{}, err
		}
		data, err := io.ReadAll(io.LimitReader(rc, archiveMaxBytes+1))
		rc.Close()
		if err != nil {
			return config.Config{}, err
		}
		switch {
		case name == "pane.yaml":
			cfgBytes = data
		case name == "manifest.json":
			// validated loosely
		case strings.HasPrefix(name, "media/"):
			base := strings.TrimPrefix(name, "media/")
			id := strings.TrimSuffix(base, ".json")
			if strings.HasSuffix(base, ".json") {
				id = strings.TrimSuffix(base, ".json")
			} else {
				id = base
			}
			if !config.ValidMediaID(id) {
				return config.Config{}, fmt.Errorf("invalid media id in archive")
			}
			if files[id] == nil {
				files[id] = &staged{}
			}
			if strings.HasSuffix(base, ".json") {
				files[id].meta = data
			} else {
				files[id].data = data
			}
		default:
			return config.Config{}, fmt.Errorf("unexpected archive entry")
		}
	}
	if cfgBytes == nil {
		return config.Config{}, fmt.Errorf("archive missing pane.yaml")
	}
	c, err := config.DecodeYAML(cfgBytes)
	if err != nil {
		return config.Config{}, err
	}
	if store == nil {
		return c, nil
	}
	for id, st := range files {
		if len(st.data) == 0 {
			return config.Config{}, fmt.Errorf("archive media %s missing bytes", id)
		}
		info, err := store.StageUpload(bytes.NewReader(st.data), media.VideoUploadLimit, id, "")
		if err != nil {
			return config.Config{}, err
		}
		meta, err := store.CommitStaging(info.SessionID)
		if err != nil {
			return config.Config{}, err
		}
		// Content-addressed IDs: bytes must hash to the referenced id.
		if meta.ID != id {
			return config.Config{}, fmt.Errorf("archive media hash mismatch for %s", id)
		}
	}
	if err := ValidateConfigMedia(c, store); err != nil {
		return config.Config{}, err
	}
	return c, nil
}

// ValidateConfigMedia verifies that media referenced by a configuration exists
// in the store. It bridges the config and media packages (which must not import
// each other).
func ValidateConfigMedia(c config.Config, store *media.MediaStore) error {
	if c.Appearance.Background != nil {
		if err := validateBackgroundAssets(c.Appearance.Background, store); err != nil {
			return err
		}
	}
	if store != nil {
		for _, ref := range []struct {
			path string
			name string
		}{
			{c.Dashboard.Logo, "logo"},
			{c.Dashboard.Icon, "icon"},
		} {
			if id, ok := config.LogoAssetID(ref.path); ok {
				if _, err := store.GetMeta(id); err != nil {
					return fmt.Errorf("missing %s media asset", ref.name)
				}
			}
		}
	}
	return nil
}

func validateBackgroundAssets(b *config.Background, store *media.MediaStore) error {
	if b == nil || store == nil {
		return nil
	}
	check := func(r config.MediaRef, want *media.MediaKind) error {
		if r.Source != "asset" {
			return nil
		}
		meta, err := store.GetMeta(r.AssetID)
		if err != nil {
			return fmt.Errorf("missing media asset")
		}
		if want != nil && meta.Kind != *want {
			return fmt.Errorf("media kind mismatch")
		}
		return nil
	}
	if b.Wallpaper.Media != nil {
		var want *media.MediaKind
		switch b.Wallpaper.Kind {
		case "image":
			k := media.MediaKindImage
			want = &k
		case "video":
			k := media.MediaKindVideo
			want = &k
		}
		if err := check(*b.Wallpaper.Media, want); err != nil {
			return err
		}
	}
	for i, r := range b.Library {
		if err := check(r, nil); err != nil {
			return fmt.Errorf("library[%d]: %w", i, err)
		}
	}
	return nil
}
