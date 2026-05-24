import type { Position } from './types'

export const POSITIONS: Position[] = [
  {
    id: 'president',
    title: 'President',
    candidates: [
      { id: '7db5f570-eae2-4511-becd-6f513cea0b3b', name: 'Kwame Asante',  faculty: 'IT - L400',          slogan: 'Building bridges, not walls.',           manifesto_url: '/manifestos/Kwame_Asante_President.pdf',    highlights: ['Free printing credits for all students', 'Extended library hours', 'Better campus Wi-Fi'] },
      { id: 'e27c08b5-ec51-492e-b207-25051434e860', name: 'Esi Boateng',   faculty: 'Engineering - L400', slogan: 'A voice for every student.',             manifesto_url: '/manifestos/Esi_Boateng_President.pdf',     highlights: ['Student welfare fund', 'Transparent governance', 'Internship partnerships'] },
      { id: '50c64e21-5329-48f1-b799-67edc14a2bac', name: 'Michael Agyei', faculty: 'Computing - L400',   slogan: 'Innovation starts with us.',             manifesto_url: '/manifestos/Michael_Agyei_President.pdf',   highlights: ['Tech hub launch', 'Coding bootcamps', 'Industry mentorship program'] },
    ],
  },
  {
    id: 'vice-president',
    title: 'Vice President',
    candidates: [
      { id: '79041a66-e849-42fc-a3b8-76bfce11ea9b', name: 'Samuel Bekoe', faculty: 'Business - L300', slogan: 'Service above self.',           manifesto_url: '/manifestos/Samuel_Bekoe_Vice_President.pdf', highlights: ['Student support helpdesk', 'Faculty liaison office', 'Academic advisory sessions'] },
      { id: '7ac311d3-aac4-4637-ba15-38f6831bd072', name: 'Janet Owusu',  faculty: 'IT - L300',       slogan: 'Inclusion, integrity, impact.', manifesto_url: '/manifestos/Janet_Owusu_Vice_President.pdf',  highlights: ['Gender equity taskforce', 'Disability-friendly campus push', 'Scholarship tracking portal'] },
    ],
  },
  {
    id: 'general-secretary',
    title: 'General Secretary',
    candidates: [
      { id: '2b1ae93f-645d-4453-bd50-281f8d04ccc7', name: 'Abena Kusi',    faculty: 'Applied Sci. - L300', slogan: 'Transparency is my commitment.',     highlights: ['Public meeting minutes', 'Student petition portal', 'Feedback-first governance'] },
      { id: 'e18e6f4b-a36d-492a-8561-b734222781b1', name: 'Francis Adjei', faculty: 'Computing - L300',    slogan: 'Organized. Focused. Accountable.',   highlights: ['Digital records system', 'Event calendar app', 'Annual audit reports'] },
      { id: '851ea7fe-e475-48f4-8f3c-1cdee9ecca54', name: 'Kofi Oppong',   faculty: 'Engineering - L400',  slogan: 'Every voice deserves to be heard.',  highlights: ['Town halls every semester', 'Anonymous complaint box', 'Student ombudsman office'] },
    ],
  },
  {
    id: 'financial-secretary',
    title: 'Financial Secretary',
    candidates: [
      { id: 'c7fb6a2a-9b16-4bac-9d9b-4a736bb26769', name: 'Efia Amponsah', faculty: 'Business - L400', slogan: 'Your dues, working for you.',    highlights: ['Budget transparency reports', 'Dues reduction campaign', 'Emergency student fund'] },
      { id: '67a03e20-f522-4add-88d5-85440693ded2', name: 'Nana Baah',     faculty: 'Business - L300', slogan: 'Smart money, brighter futures.', highlights: ['Financial literacy workshops', 'Savings scheme for students', 'Sponsorship drive'] },
    ],
  },
  {
    id: 'womens-commissioner',
    title: "Women's Commissioner",
    candidates: [
      { id: 'd633699e-0b75-4512-b641-f76800d5bc42', name: 'Kaakie Mensah', faculty: 'IT - L300',           slogan: 'Empowered women, empowered campus.',      highlights: ['STEM mentorship for women', 'Safe spaces initiative', 'Sanitary product drive'] },
      { id: 'a946090b-3de8-4dba-8c53-779eb1adc529', name: 'Adwoa Bempong', faculty: 'Applied Sci. - L400', slogan: 'Safety, support, sisterhood.',            highlights: ['Night safety escorts', 'Women in leadership program', 'Counseling access expansion'] },
      { id: 'a0a180e2-5ea2-4590-bed3-f3c64162883e', name: 'Serwaa Osei',   faculty: 'Computing - L300',    slogan: 'Breaking barriers, one step at a time.', highlights: ['Female coding club', 'Harassment reporting system', 'Mentorship Fridays'] },
    ],
  },
  {
    id: 'sports-officer',
    title: 'Sports Officer',
    candidates: [
      { id: '6f70467e-1967-498c-8d2c-4e6ea5f9cd9d', name: 'Prince Koomson', faculty: 'Engineering - L300', slogan: 'Winning starts in the mind.',  highlights: ['New sports equipment fund', 'Inter-faculty games revival', 'Fitness centre expansion'] },
      { id: '0ae5e0e5-5808-45d0-a773-8326310f2ef9', name: 'Rita Appiah',    faculty: 'IT - L400',           slogan: 'Active bodies, active minds.', highlights: ['Women in sports campaign', 'Sports scholarship drive', 'Health & wellness week'] },
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