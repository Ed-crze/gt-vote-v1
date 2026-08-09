import jsPDF from 'jspdf'

type CandidateResult = {
  name: string
  votes: number
  pct: number
}

type PositionResult = {
  title: string
  total: number
  candidates: CandidateResult[]
}

export function generateResultsPDF({
  totalVoters,
  votesCast,
  turnout,
  resultsData,
  generatedAt,
}: {
  totalVoters: number
  votesCast: number
  turnout: number
  resultsData: PositionResult[]
  generatedAt: string
}) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const NAVY = [27, 42, 94] as [number, number, number]
  const GOLD = [201, 162, 39] as [number, number, number]
  const WHITE = [255, 255, 255] as [number, number, number]
  const GRAY = [100, 100, 100] as [number, number, number]
  const LIGHT = [245, 245, 245] as [number, number, number]

  // ── Header banner ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(...WHITE)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('GT-Vote', pageWidth / 2, 14, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('GCTU SRC Elections 2025 / 2026 — Official Results Report', pageWidth / 2, 22, { align: 'center' })
  doc.text(`Generated: ${generatedAt}`, pageWidth / 2, 30, { align: 'center' })

  // ── Gold divider ──
  doc.setFillColor(...GOLD)
  doc.rect(0, 40, pageWidth, 2, 'F')

  // ── Summary stats ──
  let y = 54

  doc.setFillColor(...LIGHT)
  doc.rect(14, y - 6, pageWidth - 28, 22, 'F')

  doc.setTextColor(...NAVY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')

  const col1 = 30
  const col2 = pageWidth / 2 - 10
  const col3 = pageWidth - 50

  doc.text(`Total Voters`, col1, y)
  doc.text(`Votes Cast`, col2, y)
  doc.text(`Turnout`, col3, y)

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GOLD)

  y += 10
  doc.text(`${totalVoters.toLocaleString()}`, col1, y)
  doc.text(`${votesCast.toLocaleString()}`, col2, y)
  doc.text(`${turnout}%`, col3, y)

  y += 16

  // ── Results per position ──
  for (const pos of resultsData) {
    // Check if we need a new page
    if (y > 240) {
      doc.addPage()
      y = 20
    }

    // Position header
    doc.setFillColor(...NAVY)
    doc.rect(14, y, pageWidth - 28, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(pos.title.toUpperCase(), 18, y + 7)
    doc.text(`${pos.total} vote${pos.total !== 1 ? 's' : ''}`, pageWidth - 18, y + 7, { align: 'right' })
    y += 14

    // Candidates
    for (let i = 0; i < pos.candidates.length; i++) {
      const c = pos.candidates[i]
      const isLeader = i === 0

      // Row background
      doc.setFillColor(isLeader ? 240 : 250, isLeader ? 245 : 250, isLeader ? 230 : 250)
      doc.rect(14, y - 4, pageWidth - 28, 14, 'F')

      // Leading badge
      if (isLeader && pos.total > 0) {
        doc.setFillColor(...GOLD)
        doc.rect(14, y - 4, 18, 14, 'F')
        doc.setTextColor(...WHITE)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.text('LEAD', 23, y + 4, { align: 'center' })
      }

      // Name
      doc.setTextColor(...NAVY)
      doc.setFontSize(10)
      doc.setFont('helvetica', isLeader ? 'bold' : 'normal')
      doc.text(c.name, 36, y + 4)

      // Votes and percentage
      doc.setTextColor(...GRAY)
      doc.setFontSize(9)
      doc.text(`${c.votes} votes`, pageWidth - 45, y + 4)
      doc.setTextColor(isLeader ? GOLD[0] : GRAY[0], isLeader ? GOLD[1] : GRAY[1], isLeader ? GOLD[2] : GRAY[2])
      doc.setFont('helvetica', 'bold')
      doc.text(`${c.pct}%`, pageWidth - 18, y + 4, { align: 'right' })

      // Progress bar background
      const barX = 36
      const barY = y + 7
      const barWidth = pageWidth - 80
      doc.setFillColor(220, 220, 220)
      doc.rect(barX, barY, barWidth, 2, 'F')

      // Progress bar fill
      doc.setFillColor(isLeader ? GOLD[0] : 100, isLeader ? GOLD[1] : 150, isLeader ? GOLD[2] : 200)
      doc.rect(barX, barY, (barWidth * c.pct) / 100, 2, 'F')

      y += 16
    }

    y += 6
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(...NAVY)
    doc.rect(0, doc.internal.pageSize.getHeight() - 12, pageWidth, 12, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `GT-Vote — GCTU SRC Elections 2025/2026  |  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 4,
      { align: 'center' }
    )
  }

  // ── Download ──
  const filename = `GT-Vote-Results-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}