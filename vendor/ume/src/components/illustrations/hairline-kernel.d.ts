/* Types for the vendored Hairline engine (hairline-kernel.js): only what
   Illustration.tsx and the figures' declarations use. */
export type HairlineRead = { textContent: string | null }
export type HairlineHandle = { set(value: number): void; destroy(): void }
export type HairlineFigure = {
  name: string
  means: string
  rules: number[]
  range: [number, number, number]
  mount(
    host: { stage: HTMLElement; svg: SVGSVGElement; read: HairlineRead },
    value: number,
  ): HairlineHandle
}
declare const HL: {
  inject(root: Document | ShadowRoot): void
  mk(tag: string, attrs: Record<string, string>, parent: Element): SVGElement
}
export default HL
