/**
 * Per-pane SVG filter: centre-magnifying lip + soft chroma.
 * Map layout: R=X, G=Y, B=lip strength, A=255.
 * Displacement covers the whole surface — the map already goes neutral in the
 * centre. Edge/centre compositing is avoided (that drew the hard inner frame).
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
  // Positive scale — map encodes centre-magnifying offsets (shader-style).
  const redScale = displacement;
  const greenScale = displacement * (1 - aberration * 0.05);
  const blueScale = displacement * (1 - aberration * 0.1);
  const soften = Math.max(0.25, 0.55 - aberration * 0.05);
  const liteScale = Math.round(displacement * 0.7);

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
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={liteScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
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
            preserveAspectRatio="none"
            result="map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={redScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="redDisp"
          />
          <feColorMatrix
            in="redDisp"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="red"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={greenScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="greenDisp"
          />
          <feColorMatrix
            in="greenDisp"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="green"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={blueScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="blueDisp"
          />
          <feColorMatrix
            in="blueDisp"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="blue"
          />
          <feBlend in="green" in2="blue" mode="screen" result="gb" />
          <feBlend in="red" in2="gb" mode="screen" result="rgb" />
          <feGaussianBlur in="rgb" stdDeviation={soften} />
        </filter>
      </defs>
    </svg>
  );
}
