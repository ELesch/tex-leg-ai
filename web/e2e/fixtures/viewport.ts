export const VIEWPORTS = {
  mobile_xs: { width: 320, height: 568 },
  mobile_sm: { width: 375, height: 667 },
  mobile_md: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
} as const;

export const TAILWIND_MD_BREAKPOINT = 768;

export type ViewportName = keyof typeof VIEWPORTS;

export function isMobileViewport(width: number): boolean {
  return width < TAILWIND_MD_BREAKPOINT;
}
