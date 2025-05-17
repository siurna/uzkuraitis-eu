import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function POST(request: Request) {
  console.log("API route called: POST /api/votes")

  try {
    // Get Supabase client
    const supabase = getSupabaseServerClient()

    // Check if voting is enabled
    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "voting_enabled")
      .single()

    if (!settingsError && settingsData && settingsData.value === "false") {
      console.error("Voting is disabled")
      return NextResponse.json({ error: "Voting is currently disabled by the administrator." }, { status: 403 })
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { name, votes, lithuaniaPrediction, sessionId } = body

    if (!name || !votes) {
      console.error("Missing required fields:", { name: !!name, votes: !!votes })
      return NextResponse.json({ error: "Name and votes are required" }, { status: 400 })
    }

    console.log("Received votes:", votes)
    console.log("Lithuania prediction:", lithuaniaPrediction)
    console.log("Session ID:", sessionId)

    // Instead of using the submit_votes function, let's insert directly into the tables
    // First, create or update the voter
    let voterId
    try {
      // Check if this session already has a voter
      if (sessionId) {
        const { data: existingVoter } = await supabase
          .from("voters")
          .select("id")
          .eq("session_id", sessionId)
          .maybeSingle()

        if (existingVoter) {
          // Update existing voter
          voterId = existingVoter.id
          await supabase
            .from("voters")
            .update({
              name,
              lithuania_prediction: lithuaniaPrediction || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", voterId)
        } else {
          // Create new voter
          const { data: newVoter, error: voterError } = await supabase
            .from("voters")
            .insert({
              name,
              session_id: sessionId,
              lithuania_prediction: lithuaniaPrediction || null,
            })
            .select("id")
            .single()

          if (voterError) {
            console.error("Error creating voter:", voterError)
            return NextResponse.json({ error: voterError.message }, { status: 500 })
          }

          voterId = newVoter.id
        }
      } else {
        // No session ID, create new voter
        const { data: newVoter, error: voterError } = await supabase
          .from("voters")
          .insert({
            name,
            lithuania_prediction: lithuaniaPrediction || null,
          })
          .select("id")
          .single()

        if (voterError) {
          console.error("Error creating voter:", voterError)
          return NextResponse.json({ error: voterError.message }, { status: 500 })
        }

        voterId = newVoter.id
      }

      // Delete existing votes for this voter
      await supabase.from("votes").delete().eq("voter_id", voterId)

      // Insert new votes
      const voteRecords = Object.entries(votes).map(([pointsStr, countryCode]) => {
        // Convert points string to integer
        const points = Number.parseInt(pointsStr, 10)
        return {
          voter_id: voterId,
          country_code: countryCode,
          points: points, // Explicitly as integer
        }
      })

      console.log("Inserting vote records:", voteRecords)

      const { error: votesError } = await supabase.from("votes").insert(voteRecords)

      if (votesError) {
        console.error("Error inserting votes:", votesError)
        return NextResponse.json({ error: votesError.message }, { status: 500 })
      }

      console.log("Successfully saved votes for voter:", voterId)

      return NextResponse.json({
        success: true,
        voterId,
      })
    } catch (error) {
      console.error("Error in vote submission process:", error)
      return NextResponse.json({ error: "An error occurred during vote submission" }, { status: 500 })
    }
  } catch (error) {
    console.error("Unexpected error saving votes:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
