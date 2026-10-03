package main

import "fmt"

// Upgrade preserves all IDs, app coordinates and gaps. A single axis scale moves
// every old outer coordinate consistently, keeping relative placement and avoiding
// overlaps as fixed-size tiles replace stretched panels. No runtime reflow engine.
func upgrade(c Config) (Config, error) {
	if c.Version == 2 {
		return c, nil
	}
	items := make([]Pane, len(c.Items))
	copy(items, c.Items)
	scaleX, scaleY := 1, 1
	for i, p := range items {
		cols, rows := capacity(p.Layout, c.Dashboard.Width, c.Appearance.AppSize)
		for _, a := range p.Apps {
			cols = max(cols, a.Col+1)
			rows = max(rows, a.Row+1)
		}
		if cols > 32 || rows > 32 {
			return c, fmt.Errorf("legacy pane exceeds 32 columns or rows; original configuration has not been changed")
		}
		items[i].Layout.W = cols
		items[i].Layout.H = rows
		footprint := frame(items[i].Layout)
		scaleX = max(scaleX, (footprint.W+p.Layout.W-1)/p.Layout.W)
		scaleY = max(scaleY, (footprint.H+p.Layout.H-1)/p.Layout.H)
	}
	for i := range items {
		items[i].Layout.X *= scaleX
		items[i].Layout.Y *= scaleY
		c.Dashboard.Width = max(c.Dashboard.Width, (items[i].Layout.X+frame(items[i].Layout).W)*8)
	}
	c.Items = items
	c.Version = 2
	c.Appearance.AppSize = ""
	if err := validate(c); err != nil {
		return c, fmt.Errorf("cannot safely migrate layout: %w", err)
	}
	return c, nil
}
