package config

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

// Sentinel errors returned by SaveWithRevision so callers can map them to HTTP
// status codes without touching unexported store state.
var (
	ErrRevisionRequired = errors.New("If-Match revision required")
	ErrRevisionMismatch = errors.New("Configuration changed in another session. Reload before editing.")
)

// ValidationError wraps a save-time validation failure (reported as 400).
type ValidationError struct{ Err error }

func (e *ValidationError) Error() string { return e.Err.Error() }
func (e *ValidationError) Unwrap() error { return e.Err }

type Store struct {
	mu       sync.Mutex
	path     string
	config   Config
	revision string
}

func revision(c Config) string { b, _ := json.Marshal(c); return fmt.Sprintf(`"%x"`, sha256.Sum256(b)) }

func peekConfigVersion(data []byte) int {
	var peek struct {
		Version int `yaml:"version" json:"version"`
	}
	_ = yaml.Unmarshal(data, &peek)
	return peek.Version
}

func backupOriginal(path string, original []byte) (string, error) {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	name := fmt.Sprintf("%s.schema3-backup-%s", base, time.Now().UTC().Format("20060102T150405Z"))
	dest := filepath.Join(dir, name)
	if _, err := os.Stat(dest); err == nil {
		return "", fmt.Errorf("backup already exists: %s", dest)
	} else if err != nil && !os.IsNotExist(err) {
		return "", err
	}
	if err := os.WriteFile(dest, original, 0600); err != nil {
		return "", err
	}
	return dest, nil
}

// Open loads the configuration beside the given path, creating defaults when the
// file is missing. Schema 3 files are converted to schema 4 after a unique backup
// of the original bytes. Invalid existing files are never rewritten.
func Open(path string) (*Store, error) {
	s := &Store{path: path}
	b, e := os.ReadFile(path)
	if os.IsNotExist(e) {
		s.config = DefaultConfig()
		if e = s.write(s.config); e != nil {
			return nil, e
		}
	} else if e != nil {
		return nil, e
	} else {
		ver := peekConfigVersion(b)
		s.config, e = DecodeYAML(b)
		if e != nil {
			return nil, fmt.Errorf("refusing to replace invalid %s: %w", path, e)
		}
		if ver == 3 {
			if _, err := backupOriginal(path, b); err != nil {
				return nil, fmt.Errorf("refusing to convert %s without backup: %w", path, err)
			}
			if err := s.write(s.config); err != nil {
				return nil, fmt.Errorf("converted configuration could not be written (original preserved in backup): %w", err)
			}
		}
	}
	s.revision = revision(s.config)
	return s, nil
}

// Get returns a copy of the current configuration.
func (s *Store) Get() Config {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.config
}

// Revision returns the current ETag revision.
func (s *Store) Revision() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.revision
}

// GetWithRevision atomically returns the configuration and its revision.
func (s *Store) GetWithRevision() (Config, string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.config, s.revision
}

// SaveWithRevision performs an optimistic-concurrency save. It checks the
// If-Match revision, runs the optional validate callback (reported as a
// ValidationError on failure), writes atomically, and updates in-memory state.
// On any failure the previous in-memory configuration and revision are kept.
func (s *Store) SaveWithRevision(ifMatch string, c Config, validate func(Config) error) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if ifMatch == "" {
		return "", ErrRevisionRequired
	}
	if ifMatch != s.revision {
		return "", ErrRevisionMismatch
	}
	if validate != nil {
		if err := validate(c); err != nil {
			return "", &ValidationError{Err: err}
		}
	}
	if err := s.write(c); err != nil {
		return "", err
	}
	s.config = c
	s.revision = revision(c)
	return s.revision, nil
}

func (s *Store) write(c Config) error {
	b, e := yaml.Marshal(c)
	if e != nil {
		return e
	}
	dir := filepath.Dir(s.path)
	if e = os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	f, e := os.CreateTemp(dir, ".pane-*.tmp")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(b); e != nil {
		f.Close()
		return e
	}
	if e = f.Sync(); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	if e = os.Rename(name, s.path); e != nil {
		return e
	}
	if d, e := os.Open(dir); e == nil {
		defer d.Close()
		_ = d.Sync()
	}
	return nil
}
