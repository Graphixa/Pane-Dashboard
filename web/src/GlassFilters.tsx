/**
 * Per-pane SVG filter: edge-masked displacement + clean centre + RGB chroma.
 *
 * Filter graph adapted from rdev/liquid-glass-react `GlassFilter` (MIT).
 * Map: R=X, G=Y, B=Y. Positive scale (their shader-mode branch).
 * Aberration 0 skips the RGB split (one displacement instead of three).
 */

import {
  glassAberrationUnits,
  glassDisplacementScale,
} from "./appearance";

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
  // Stored controls are 0–100; filter maths still use the former 0–150 / 0–5 scales.
  const scale = glassDisplacementScale(displacement);
  const aber = glassAberrationUnits(aberration);
  const redScale = scale;
  const greenScale = scale * (1 - aber * 0.05);
  const blueScale = scale * (1 - aber * 0.1);
  const soften = Math.max(0.1, 0.5 - aber * 0.1);
  const liteScale = Math.round(scale * 0.7);
  const discrete = `0 ${Math.max(0, aber * 0.05)} 1`;
  const full = !lite;
  const rgb = full && aberration > 0;

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
          x={lite ? "-20%" : "-35%"}
          y={lite ? "-20%" : "-35%"}
          width={lite ? "140%" : "170%"}
          height={lite ? "140%" : "170%"}
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={mapUrl}
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            result={lite ? "map" : "DISPLACEMENT_MAP"}
          />
          {lite ? (
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={liteScale}
              xChannelSelector="R"
              yChannelSelector="B"
            />
          ) : (
            <>
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
              {rgb ? (
                <>
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
                </>
              ) : (
                <>
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
                  <feComposite
                    in="EDGE_BEND"
                    in2="CENTER_CLEAN"
                    operator="over"
                  />
                </>
              )}
            </>
          )}
        </filter>
      </defs>
    </svg>
  );
}
