package main

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
func ExportArchive(w io.Writer, c Config, media *MediaStore) error {
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
		ids = collectAssetIDs(*c.Appearance.Background, c.Dashboard.Logo)
	} else if id, ok := logoAssetID(c.Dashboard.Logo); ok {
		ids[id] = struct{}{}
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
	if media == nil {
		return nil
	}
	for id := range ids {
		meta, err := media.GetMeta(id)
		if err != nil {
			return fmt.Errorf("export missing asset %s", id)
		}
		data, err := os.ReadFile(media.assetPath(id))
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
func ImportArchivePreview(r io.ReaderAt, size int64, media *MediaStore) (Config, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return Config{}, fmt.Errorf("invalid archive")
	}
	if len(zr.File) > archiveMaxEntries {
		return Config{}, fmt.Errorf("archive has too many entries")
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
			return Config{}, fmt.Errorf("archive path not allowed")
		}
		if f.UncompressedSize64 > archiveMaxBytes {
			return Config{}, fmt.Errorf("archive entry too large")
		}
		total += int64(f.UncompressedSize64)
		if total > archiveMaxBytes {
			return Config{}, fmt.Errorf("archive exceeds size limit")
		}
		rc, err := f.Open()
		if err != nil {
			return Config{}, err
		}
		data, err := io.ReadAll(io.LimitReader(rc, archiveMaxBytes+1))
		rc.Close()
		if err != nil {
			return Config{}, err
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
			if !validMediaID(id) {
				return Config{}, fmt.Errorf("invalid media id in archive")
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
			return Config{}, fmt.Errorf("unexpected archive entry")
		}
	}
	if cfgBytes == nil {
		return Config{}, fmt.Errorf("archive missing pane.yaml")
	}
	c, err := decodeYAML(cfgBytes)
	if err != nil {
		return Config{}, err
	}
	if media == nil {
		return c, nil
	}
	for id, st := range files {
		if len(st.data) == 0 {
			return Config{}, fmt.Errorf("archive media %s missing bytes", id)
		}
		info, err := media.StageUpload(bytes.NewReader(st.data), mediaVideoUploadLimit, id, "")
		if err != nil {
			return Config{}, err
		}
		meta, err := media.CommitStaging(info.SessionID)
		if err != nil {
			return Config{}, err
		}
		// Content-addressed IDs: bytes must hash to the referenced id.
		if meta.ID != id {
			return Config{}, fmt.Errorf("archive media hash mismatch for %s", id)
		}
	}
	if err := validateConfigMedia(c, media); err != nil {
		return Config{}, err
	}
	return c, nil
}
