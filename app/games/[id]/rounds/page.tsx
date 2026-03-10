import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function RoundsPage({ params }: Props) {
  const { id } = await params
  redirect(`/games/${id}`)
}
