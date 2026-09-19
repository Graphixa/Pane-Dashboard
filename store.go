package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"gopkg.in/yaml.v3"
)

type Store struct {
	mu       sync.Mutex
	path     string
	config   Config
	revision string
}

func revision(c Config) string { b, _ := json.Marshal(c); return fmt.Sprintf(`"%x"`, sha256.Sum256(b)) }
func openStore(path string) (*Store, error) {
	s := &Store{path: path}
	b, e := os.ReadFile(path)
	if os.IsNotExist(e) {
		s.config = defaultConfig()
		if e = s.write(s.config); e != nil {
			return nil, e
		}
	} else if e != nil {
		return nil, e
	} else {
		s.config, e = decodeYAML(b)
		if e != nil {
			return nil, fmt.Errorf("refusing to replace invalid %s: %w", path, e)
		}
		if s.config.Version == 1 {
			next, err := upgrade(s.config)
			if err != nil {
				return nil, err
			}
			// Exclusive creation never overwrites an earlier backup.
			backup, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".v1-*.bak")
			if err != nil {
				return nil, err
			}
			if _, err = backup.Write(b); err != nil {
				backup.Close()
				return nil, err
			}
			if err = backup.Sync(); err != nil {
				backup.Close()
				return nil, err
			}
			if err = backup.Close(); err != nil {
				return nil, err
			}
			if err = s.write(next); err != nil {
				return nil, err
			}
			s.config = next
		}
	}
	s.revision = revision(s.config)
	return s, nil
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
