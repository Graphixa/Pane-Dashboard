import { createContext, useContext, CSSProperties, HTMLAttributes, ReactNode } from 'react';
type Surface = {style?: CSSProperties; 'data-theme'?: 'dark' | 'light'};
const SurfaceContext = createContext<Surface>({});
export const useSurface = () => useContext(SurfaceContext);
/** Portal content must receive live theme variables, including unsaved previews. */
export function SurfaceProvider({children, style, theme}: {children: ReactNode; style?: CSSProperties; theme?: 'dark' | 'light'}) {
  const parent = useSurface();
  return <SurfaceContext.Provider value={{style: {...parent.style, ...style}, 'data-theme': theme ?? parent['data-theme']}}>{children}</SurfaceContext.Provider>;
}
export function ThemeSurface({children, theme, ...props}: HTMLAttributes<HTMLDivElement> & {theme: 'dark' | 'light'}) {
  return <SurfaceProvider style={props.style} theme={theme}><div {...props} data-theme={theme}>{children}</div></SurfaceProvider>;
}
