import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function POST(request: Request) {
  console.log("API route called: POST /api/vote/delete")

  try {
    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { voterId, points } = body

    if (!voterId || !points) {
      console.error("Missing required fields:", { voterId: !!voterId, points: !!points })
      return NextResponse.json({ error: "Voter ID and points are required" }, { status: 400 })
    }

    console.log(`Deleting vote with ${points} points for voter ${voterId}`)

    // Get Supabase client
    const supabase = getSupabaseServerClient()

    // Delete the specific vote
    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("voter_id", voterId)
      .eq("points", Number.parseInt(points, 10))

    if (error) {
      console.error("Error deleting vote:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("Vote deleted successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error deleting vote:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
