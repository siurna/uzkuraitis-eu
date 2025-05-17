import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const voterId = params.id

  if (!voterId) {
    return NextResponse.json({ error: "Voter ID is required" }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServerClient()

    // Delete votes for this voter
    const { error: votesError } = await supabase.from("votes").delete().eq("voter_id", voterId)

    if (votesError) {
      console.error("Error deleting votes:", votesError)
      return NextResponse.json({ error: votesError.message }, { status: 500 })
    }

    // Delete the voter
    const { error: voterError } = await supabase.from("voters").delete().eq("id", voterId)

    if (voterError) {
      console.error("Error deleting voter:", voterError)
      return NextResponse.json({ error: voterError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting voter:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
