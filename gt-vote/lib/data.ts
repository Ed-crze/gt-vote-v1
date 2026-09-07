import type { Position } from './types'

export const POSITIONS: Position[] = [
  {
    id: 'president',
    title: 'President',
    candidates: [
      { name: 'Kwame Asante',   faculty: 'IT - L400',          slogan: 'Building bridges, not walls.',              highlights: ['Free printing credits for all students', 'Extended library hours', 'Better campus Wi-Fi'] },
      { name: 'Esi Boateng',    faculty: 'Engineering - L400',  slogan: 'A voice for every student.',                highlights: ['Student welfare fund', 'Transparent governance', 'Internship partnerships'] },
      { name: 'Michael Agyei',  faculty: 'Computing - L400',    slogan: 'Innovation starts with us.',                highlights: ['Tech hub launch', 'Coding bootcamps', 'Industry mentorship program'] },
    ],
  },
  {
    id: 'vice-president',
    title: 'Vice President',
    candidates: [
      { name: 'Samuel Bekoe',   faculty: 'Business - L300',     slogan: 'Service above self.',                       highlights: ['Student support helpdesk', 'Faculty liaison office', 'Academic advisory sessions'] },
      { name: 'Janet Owusu',    faculty: 'IT - L300',           slogan: 'Inclusion, integrity, impact.',             highlights: ['Gender equity taskforce', 'Disability-friendly campus push', 'Scholarship tracking portal'] },
    ],
  },
  {
    id: 'general-secretary',
    title: 'General Secretary',
    candidates: [
      { name: 'Abena Kusi',     faculty: 'Applied Sci. - L300', slogan: 'Transparency is my commitment.',            highlights: ['Public meeting minutes', 'Student petition portal', 'Feedback-first governance'] },
      { name: 'Francis Adjei',  faculty: 'Computing - L300',    slogan: 'Organized. Focused. Accountable.',          highlights: ['Digital records system', 'Event calendar app', 'Annual audit reports'] },
      { name: 'Kofi Oppong',    faculty: 'Engineering - L400',  slogan: 'Every voice deserves to be heard.',         highlights: ['Town halls every semester', 'Anonymous complaint box', 'Student ombudsman office'] },
    ],
  },
  {
    id: 'financial-secretary',
    title: 'Financial Secretary',
    candidates: [
      { name: 'Efia Amponsah',  faculty: 'Business - L400',     slogan: 'Your dues, working for you.',               highlights: ['Budget transparency reports', 'Dues reduction campaign', 'Emergency student fund'] },
      { name: 'Nana Baah',      faculty: 'Business - L300',     slogan: 'Smart money, brighter futures.',            highlights: ['Financial literacy workshops', 'Savings scheme for students', 'Sponsorship drive'] },
    ],
  },
  {
    id: 'womens-commissioner',
    title: "Women's Commissioner",
    candidates: [
      { name: 'Kaakie Mensah',  faculty: 'IT - L300',           slogan: 'Empowered women, empowered campus.',        highlights: ['STEM mentorship for women', 'Safe spaces initiative', 'Sanitary product drive'] },
      { name: 'Adwoa Bempong',  faculty: 'Applied Sci. - L400', slogan: 'Safety, support, sisterhood.',              highlights: ['Night safety escorts', 'Women in leadership program', 'Counseling access expansion'] },
      { name: 'Serwaa Osei',    faculty: 'Computing - L300',    slogan: 'Breaking barriers, one step at a time.',    highlights: ['Female coding club', 'Harassment reporting system', 'Mentorship Fridays'] },
    ],
  },
  {
    id: 'sports-officer',
    title: 'Sports Officer',
    candidates: [
      { name: 'Prince Koomson', faculty: 'Engineering - L300',  slogan: 'Winning starts in the mind.',              highlights: ['New sports equipment fund', 'Inter-faculty games revival', 'Fitness centre expansion'] },
      { name: 'Rita Appiah',    faculty: 'IT - L400',           slogan: 'Active bodies, active minds.',              highlights: ['Women in sports campaign', 'Sports scholarship drive', 'Health & wellness week'] },
    ],
  },
]

export const FACULTY_LEADERBOARD = [
  { name: 'Faculty of IT',           pct: 82, rank: 1 },
  { name: 'Faculty of Engineering',  pct: 74, rank: 2 },
  { name: 'Faculty of Computing',    pct: 68, rank: 3 },
  { name: 'Faculty of Business',     pct: 55, rank: 4 },
  { name: 'Faculty of Applied Sci.', pct: 41, rank: 5 },
]
