/**
 * Per-pane SVG filter: edge-masked displacement + clean centre + RGB chroma.
 *
 * Filter graph adapted from rdev/liquid-glass-react `GlassFilter` (MIT).
 * Map: R=X, G=Y, B=Y. Positive scale (their shader-mode branch).
 * Aberration 0 skips the RGB split (one displacement instead of three).
 */

export default function GlassFilters({
  filterId,
  mapUrl,
  displacement,
  aberration,
  lite,
}: {
  filterId: string;
  mapUrl: string;
  displacement: number;
  aberration: number;
  lite?: boolean;
}) {
  const sign = 1; // shader-parity maps use positive scale
  const redScale = displacement * sign;
  const greenScale = displacement * (sign - aberration * 0.05);
  const blueScale = displacement * (sign - aberration * 0.1);
  const soften = Math.max(0.1, 0.5 - aberration * 0.1);
  const liteScale = Math.round(displacement * 0.7);
  const discrete = `0 ${Math.max(0, aberration * 0.05)} 1`;

  if (lite) {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        className="glass-filter-defs"
        width={0}
        height={0}
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={mapUrl}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={liteScale}
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      </svg>
    );
  }

  // Edge-masked single displacement — same clean centre, one feDisplacementMap.
  if (aberration <= 0) {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        className="glass-filter-defs"
        width={0}
        height={0}
      >
        <defs>
          <filter
            id={filterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={mapUrl}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
              result="DISPLACEMENT_MAP"
            />
            <feColorMatrix
              in="DISPLACEMENT_MAP"
              type="matrix"
              values="0.3 0.3 0.3 0 0
                      0.3 0.3 0.3 0 0
                      0.3 0.3 0.3 0 0
                      0 0 0 1 0"
              result="EDGE_INTENSITY"
            />
            <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
              <feFuncA type="discrete" tableValues={discrete} />
            </feComponentTransfer>
            <feOffset
              in="SourceGraphic"
              dx="0"
              dy="0"
              result="CENTER_ORIGINAL"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="DISPLACEMENT_MAP"
              scale={redScale}
              xChannelSelector="R"
              yChannelSelector="B"
              result="DISPLACED"
            />
            <feComposite
              in="DISPLACED"
              in2="EDGE_MASK"
              operator="in"
              result="EDGE_BEND"
            />
            <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
              <feFuncA type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feComposite
              in="CENTER_ORIGINAL"
              in2="INVERTED_MASK"
              operator="in"
              result="CENTER_CLEAN"
            />
            <feComposite in="EDGE_BEND" in2="CENTER_CLEAN" operator="over" />
          </filter>
        </defs>
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="glass-filter-defs"
      width={0}
      height={0}
    >
      <defs>
        <filter
          id={filterId}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={mapUrl}
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            result="DISPLACEMENT_MAP"
          />

          <feColorMatrix
            in="DISPLACEMENT_MAP"
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0 0 0 1 0"
            result="EDGE_INTENSITY"
          />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues={discrete} />
          </feComponentTransfer>

          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={redScale}
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={greenScale}
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={blueScale}
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />

          <feBlend
            in="GREEN_CHANNEL"
            in2="BLUE_CHANNEL"
            mode="screen"
            result="GB_COMBINED"
          />
          <feBlend
            in="RED_CHANNEL"
            in2="GB_COMBINED"
            mode="screen"
            result="RGB_COMBINED"
          />

          <feGaussianBlur
            in="RGB_COMBINED"
            stdDeviation={soften}
            result="ABERRATED_BLURRED"
          />

          <feComposite
            in="ABERRATED_BLURRED"
            in2="EDGE_MASK"
            operator="in"
            result="EDGE_ABERRATION"
          />

          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite
            in="CENTER_ORIGINAL"
            in2="INVERTED_MASK"
            operator="in"
            result="CENTER_CLEAN"
          />

          <feComposite
            in="EDGE_ABERRATION"
            in2="CENTER_CLEAN"
            operator="over"
          />
        </filter>
      </defs>
    </svg>
  );
}
