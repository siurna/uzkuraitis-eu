import { getSupabaseServerClient } from "@/lib/supabase"

export async function POST(request: Request) {
  console.log("API route called: POST /api/votes-ios")

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
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/vote?error=voting-disabled",
        },
      })
    }

    // Parse form data
    let formData
    try {
      formData = await request.formData()
    } catch (error) {
      console.error("Error parsing form data:", error)
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/vote?error=invalid-form",
        },
      })
    }

    const name = formData.get("name") as string
    const votesString = formData.get("votes") as string
    const lithuaniaPrediction = formData.get("lithuaniaPrediction") as string
    const sessionId = formData.get("sessionId") as string

    console.log("Received form data:", {
      name,
      votesString: !!votesString,
      lithuaniaPrediction,
      sessionId: !!sessionId,
    })

    // Parse votes from string
    let votes
    try {
      votes = JSON.parse(votesString)
      console.log("Parsed votes:", votes)
    } catch (error) {
      console.error("Error parsing votes:", error)
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/vote?error=invalid-votes",
        },
      })
    }

    if (!name || !votes) {
      console.error("Missing required fields:", { name: !!name, votes: !!votes })
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/vote?error=missing-data",
        },
      })
    }

    // Instead of using the submit_votes function, let's insert directly into the tables
    try {
      // First, create or update the voter
      let voterId

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
            return new Response(null, {
              status: 302,
              headers: {
                Location: `/vote?error=${encodeURIComponent(voterError.message)}`,
              },
            })
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
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/vote?error=${encodeURIComponent(voterError.message)}`,
            },
          })
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
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/vote?error=${encodeURIComponent(votesError.message)}`,
          },
        })
      }

      console.log("Successfully saved votes for voter:", voterId)

      // Redirect to thank you page
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/thank-you",
        },
      })
    } catch (error) {
      console.error("Error in vote submission process:", error)
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/vote?error=submission-failed",
        },
      })
    }
  } catch (error) {
    console.error("Unexpected error saving votes:", error)
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/vote?error=unknown",
      },
    })
  }
}
