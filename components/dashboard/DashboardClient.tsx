'use client'

type Props = {
  onboardingCompleted: boolean
  children: React.ReactNode
}

export default function DashboardClient({ onboardingCompleted, children }: Props) {
  return <>{children}</>
}
