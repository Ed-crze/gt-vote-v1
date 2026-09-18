/**
 * Distribute exactly 100% across `values` using largest-remainder (Hare quota)
 * rounding.
 *
 * Rounding each share on its own lets the displayed figures drift off 100:
 * 19 / 12 / 8 out of 39 rounds to 49 + 31 + 21 = 101. Largest remainder floors
 * every share first, then hands the leftover whole points to the shares with
 * the biggest fractional parts, so the displayed figures always add up to 100 —
 * or to 0 when nothing has been counted yet.
 *
 * Returns integers in the SAME ORDER as `values`, so callers can zip the result
 * back onto their rows before sorting them for display.
 */
export function largestRemainderPercentages(values: number[]): number[] {
  const safe = values.map(v => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = safe.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return safe.map(() => 0)

  const shares = safe.map((v, index) => {
    const exact = (v / total) * 100
    const floor = Math.floor(exact)
    return { index, floor, remainder: exact - floor, value: v }
  })

  const pct = shares.map(s => s.floor)
  let leftover = 100 - pct.reduce((sum, v) => sum + v, 0)

  // Biggest fractional part wins a leftover point. Ties go to the larger vote
  // count and then to the earlier entry, so the same tally always renders the
  // same way across the results page, the dashboard and the PDF.
  const byRemainder = [...shares].sort(
    (a, b) => b.remainder - a.remainder || b.value - a.value || a.index - b.index
  )

  for (let i = 0; leftover > 0 && byRemainder.length > 0; i = (i + 1) % byRemainder.length) {
    pct[byRemainder[i].index] += 1
    leftover--
  }

  return pct
}
