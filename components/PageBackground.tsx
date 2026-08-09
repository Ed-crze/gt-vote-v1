interface PageBackgroundProps {
  children: React.ReactNode
  fadingOut?: boolean
}

export default function PageBackground({ children, fadingOut }: PageBackgroundProps) {
  return (
    <div className={`flex flex-col ${fadingOut ? 'content-fade-out' : 'content-fade-in'}`}>
      {children}
    </div>
  )
}