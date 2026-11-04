import type { SVGProps } from 'react';

// A Z cut into a square seal; the diagonal extension completes the Q.
export const brandMarkPath = 'M0 0H32V32H0V0ZM8 7V12H17L8 21V25H24V20H15L24 11V7H8Z';
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}><path d={brandMarkPath} fill="currentColor" fillRule="evenodd"/><path d="M24 24H32L40 40H32L24 24Z" fill="currentColor"/></svg>;
}
export function Brand() {
  return <><span className="brand-icon"><BrandMark/></span><span className="brand-wordmark">ZNAQ</span></>;
}
