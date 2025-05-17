import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function POST() {
  console.log("API route called: POST /api/reset")

  try {
    // Get Supabase client
    const supabase = getSupabaseServerClient()

    // Delete all votes
    const { error: votesError } = await supabase
      .from("votes")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all rows

    if (votesError) {
      console.error("Error deleting votes:", votesError)
      return NextResponse.json({ error: votesError.message }, { status: 500 })
    }

    // Delete all voters
    const { error: votersError } = await supabase
      .from("voters")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all rows

    if (votersError) {
      console.error("Error deleting voters:", votersError)
      return NextResponse.json({ error: votersError.message }, { status: 500 })
    }

    // Clear final results from settings
    const { error: finalResultsError } = await supabase.from("settings").delete().eq("key", "final_results")

    if (finalResultsError) {
      console.error("Error clearing final results:", finalResultsError)
      // Continue anyway, as this might not exist
    }

    // Clear user scores from settings
    const { error: userScoresSettingsError } = await supabase.from("settings").delete().eq("key", "user_scores")

    if (userScoresSettingsError) {
      console.error("Error clearing user scores from settings:", userScoresSettingsError)
      // Continue anyway, as this might not exist
    }

    // Check if the user_scores table exists before trying to clear it
    try {
      // First check if the table exists by querying the information schema
      const { data: tableExists, error: checkError } = await supabase.rpc("check_table_exists", {
        table_name: "user_scores",
      })

      if (checkError) {
        console.log("Error checking if user_scores table exists, skipping:", checkError.message)
      } else if (tableExists) {
        // Only try to clear the table if it exists
        const { error: userScoresError } = await supabase
          .from("user_scores")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000")

        if (userScoresError) {
          console.error("Error clearing user_scores table:", userScoresError)
          // Continue anyway
        } else {
          console.log("Successfully cleared user_scores table")
        }
      } else {
        console.log("user_scores table does not exist, skipping")
      }
    } catch (error) {
      console.log("Error handling user_scores table, skipping:", error)
      // Continue anyway
    }

    console.log("Successfully reset votes, voters, and results")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error resetting votes:", error)
    return NextResponse.json({ error: "Failed to reset votes" }, { status: 500 })
  }
}
