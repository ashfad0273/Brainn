import type * as React from "react"

/* The 404 and error pages: no card, an illustration (a Hairline figure, 320px
   wide, 384 from sm), the Title Large line, one Body Large line and the lg
   buttons, centred in the space under the page topbar. The centred line
   balances to lines of near-equal length, 40 characters at most. */
export function BlankState({
  illustration,
  title,
  description,
  actions,
}: {
  /* An Illustration, from src/components/illustrations. */
  illustration: React.ReactNode
  title: string
  description: string
  actions: React.ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex max-w-130 flex-col items-center gap-3 text-center">
        <div className="mb-2 w-80 max-w-full sm:w-96">{illustration}</div>
        <h2 className="text-title-lg text-text-figure">{title}</h2>
        <p className="max-w-[40ch] text-balance text-body-lg text-text-secondary">{description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  )
}
