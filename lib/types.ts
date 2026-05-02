export interface Student {
  id: string
  password: string
  name: string
  email?: string
  faculty: string
  level: string
  voted: boolean
  receiptCode: string | null
}

export interface Ballot {
  receiptCode: string
  timestamp: string
  votes: Record<string, string> // positionId -> candidateName
}

export interface Candidate {
  id: string
  name: string
  faculty: string
  slogan: string
  highlights: string[]
  avatar?: string
}
export interface Candidate {
  id: string
  name: string
  faculty: string
  slogan: string
  highlights: string[]
  avatar?: string
  manifesto_url?: string  // ← add this
}
export interface Position {
  id: string
  title: string
  candidates: Candidate[]
}
