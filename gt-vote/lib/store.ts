import type { Student, Ballot } from './types'

const STUDENTS_KEY = 'gtvote_students'
const CURRENT_USER_KEY = 'gtvote_current_user'
const BALLOTS_KEY = 'gtvote_ballots'

const DEMO_ACCOUNTS: Student[] = [
  { id: '4211230035', password: 'Admin123!', name: 'Klah Edward Owusu',  faculty: 'Faculty of Information Technology', level: '400', voted: false, receiptCode: null },
  { id: '4211230217', password: 'Admin123!', name: 'Edwin Komla Safo',   faculty: 'Faculty of Information Technology', level: '400', voted: false, receiptCode: null },
  { id: '4211231044', password: 'Admin123!', name: 'Lord Amprofi',       faculty: 'Faculty of Information Technology', level: '400', voted: false, receiptCode: null },
]

function isBrowser() {
  return typeof window !== 'undefined'
}

export const GTV = {
  getStudents(): Student[] {
    if (!isBrowser()) return []
    try { return JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]') } catch { return [] }
  },
  saveStudents(arr: Student[]) {
    if (!isBrowser()) return
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(arr))
  },
  getCurrentUser(): Student | null {
    if (!isBrowser()) return null
    const sid = localStorage.getItem(CURRENT_USER_KEY)
    if (!sid) return null
    return this.getStudents().find(s => s.id === sid) || null
  },
  setCurrentUser(sid: string) {
    if (!isBrowser()) return
    localStorage.setItem(CURRENT_USER_KEY, sid)
  },
  logout() {
    if (!isBrowser()) return
    localStorage.removeItem(CURRENT_USER_KEY)
  },
  getBallots(): Ballot[] {
    if (!isBrowser()) return []
    try { return JSON.parse(localStorage.getItem(BALLOTS_KEY) || '[]') } catch { return [] }
  },
  saveBallot(ballot: Ballot) {
    if (!isBrowser()) return
    const ballots = this.getBallots()
    ballots.push(ballot)
    localStorage.setItem(BALLOTS_KEY, JSON.stringify(ballots))
  },
  findBallot(code: string): Ballot | null {
    return this.getBallots().find(b => b.receiptCode === code.toUpperCase()) || null
  },
  generateReceipt(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-'
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  },
  login(sid: string, pwd: string): Student | null {
    let students = this.getStudents()
    let match = students.find(s => s.id === sid && s.password === pwd)
    if (!match) {
      const demo = DEMO_ACCOUNTS.find(s => s.id === sid && s.password === pwd)
      if (demo) {
        if (!students.find(s => s.id === sid)) {
          students.push(demo)
          this.saveStudents(students)
        }
        match = demo
      }
    }
    if (match) {
      this.setCurrentUser(match.id)
      return match
    }
    return null
  },
  register(student: Student): boolean {
    const students = this.getStudents()
    if (students.find(s => s.id === student.id)) return false
    students.push(student)
    this.saveStudents(students)
    return true
  },
  markVoted(sid: string, receiptCode: string) {
    const students = this.getStudents()
    const idx = students.findIndex(s => s.id === sid)
    if (idx >= 0) {
      students[idx].voted = true
      students[idx].receiptCode = receiptCode
      this.saveStudents(students)
    }
  },
  getStudentById(sid: string): Student | null {
    return this.getStudents().find(s => s.id === sid) || null
  },
}
