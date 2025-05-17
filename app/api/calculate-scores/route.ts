import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function POST(request: Request) {
  console.log("API route called: POST /api/calculate-scores")

  try {
    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { password } = body

    // Check password
    if (password !== "👀👀👀") {
      console.log("Unauthorized attempt: incorrect password")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseServerClient()

    // Get the final results
    console.log("Fetching final results from database...")
    const { data: resultsData, error: resultsError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "final_results")
      .single()

    if (resultsError) {
      console.error("Error fetching results:", resultsError)
      return NextResponse.json({ error: "Final results not found. Please save results first." }, { status: 404 })
    }

    console.log("Final results found, parsing data...")
    let finalResults
    try {
      finalResults = JSON.parse(resultsData.value)
    } catch (parseError) {
      console.error("Error parsing final results:", parseError)
      return NextResponse.json({ error: "Invalid final results data" }, { status: 500 })
    }

    const actualTop10 = finalResults.top10
    const actualLithuaniaPlace = Number.parseInt(finalResults.lithuaniaPlace)

    if (!Array.isArray(actualTop10) || actualTop10.length !== 10 || isNaN(actualLithuaniaPlace)) {
      console.error("Invalid final results format:", finalResults)
      return NextResponse.json({ error: "Invalid final results format" }, { status: 500 })
    }

    console.log("Fetching voters data...")
    // Get all voters with their votes
    const { data: votersData, error: votersError } = await supabase.from("voters").select(`
        id,
        name,
        lithuania_prediction,
        votes (
          country_code,
          points
        )
      `)

    if (votersError) {
      console.error("Error fetching voters:", votersError)
      return NextResponse.json({ error: votersError.message }, { status: 500 })
    }

    console.log(`Found ${votersData.length} voters, calculating scores...`)

    // Calculate scores for each voter
    const userScores = []

    for (const voter of votersData) {
      // Format votes into a map of points to country code
      const votesMap = {}
      voter.votes.forEach((vote) => {
        votesMap[vote.points] = vote.country_code
      })

      // Convert to a map of country code to position (1-indexed)
      const predictedPositions = {}
      const pointValues = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1]
      pointValues.forEach((points, index) => {
        const countryCode = votesMap[points]
        if (countryCode) {
          predictedPositions[countryCode] = index + 1 // 1-indexed position
        }
      })

      // Calculate top 10 score
      let top10Score = 0
      const pointsForPosition = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] // Points for positions 1-10

      // For each country in the user's top 10
      Object.entries(predictedPositions).forEach(([countryCode, position]) => {
        // Check if the country is in the actual top 10
        const actualPosition = actualTop10.indexOf(countryCode) + 1 // 1-indexed
        if (actualPosition > 0) {
          // Country is in the actual top 10
          if (actualPosition === position) {
            // Exact position match - full points
            top10Score += pointsForPosition[position - 1]
          } else {
            // Different position - half points (rounded down)
            top10Score += Math.floor(pointsForPosition[position - 1] / 2)
          }
        }
        // If not in top 10, no points
      })

      // Calculate Lithuania prediction score
      let lithuaniaScore = 0
      if (voter.lithuania_prediction) {
        const predictedLithuaniaPlace = Number.parseInt(voter.lithuania_prediction)
        if (!isNaN(predictedLithuaniaPlace)) {
          const difference = Math.abs(predictedLithuaniaPlace - actualLithuaniaPlace)

          if (difference === 0) {
            lithuaniaScore = 10 // Exact match
          } else if (difference === 1) {
            lithuaniaScore = 7 // 1 place off
          } else if (difference === 2) {
            lithuaniaScore = 5 // 2 places off
          } else if (difference >= 3 && difference <= 5) {
            lithuaniaScore = 3 // 3-5 places off
          } else if (difference >= 6 && difference <= 10) {
            lithuaniaScore = 1 // 6-10 places off
          }
          // More than 10 places off: 0 points
        }
      }

      // Calculate total score
      const totalScore = top10Score + lithuaniaScore

      // Add to user scores
      userScores.push({
        id: voter.id,
        name: voter.name,
        top10_score: top10Score,
        lithuania_score: lithuaniaScore,
        total_score: totalScore,
      })
    }

    console.log("Scores calculated, checking if user_scores table exists...")

    // Check if the user_scores table exists by querying the information schema
    let tableExists = false
    try {
      const { data: exists, error: checkError } = await supabase.rpc("check_table_exists", {
        table_name: "user_scores",
      })

      if (checkError) {
        console.log("Error checking if user_scores table exists:", checkError.message)
        tableExists = false
      } else {
        tableExists = exists
        console.log("user_scores table exists:", tableExists)
      }
    } catch (error) {
      console.log("Error checking user_scores table:", error)
      tableExists = false
    }

    // If the table doesn't exist, we'll store the scores in the settings table instead
    if (!tableExists) {
      console.log("user_scores table doesn't exist or is not accessible, storing scores in settings table...")

      // Format scores for storage
      const formattedScores = userScores.map((score) => ({
        id: score.id,
        name: score.name,
        top10Score: score.top10_score,
        lithuaniaScore: score.lithuania_score,
        totalScore: score.total_score,
      }))

      // Sort by total score (descending)
      formattedScores.sort((a, b) => b.totalScore - a.totalScore)

      // Store the scores in the settings table
      const { error: settingsError } = await supabase.from("settings").upsert(
        {
          key: "user_scores",
          value: JSON.stringify(formattedScores),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )

      if (settingsError) {
        console.error("Error storing scores in settings table:", settingsError)
        return NextResponse.json({ error: settingsError.message }, { status: 500 })
      }

      console.log("Scores stored successfully in settings table!")
      return NextResponse.json({
        success: true,
        scores: formattedScores,
        note: "Scores stored in settings table due to permission restrictions",
      })
    }

    // If we get here, the table exists, so we can use it
    console.log("user_scores table exists, proceeding with normal flow...")

    // Clear existing scores
    try {
      const { error: clearError } = await supabase
        .from("user_scores")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")

      if (clearError) {
        console.error("Error clearing existing scores:", clearError)
        // Continue anyway, as the table might be empty
      }
    } catch (error) {
      console.error("Error clearing existing scores:", error)
      // Continue anyway, as the table might be empty
    }

    console.log("Inserting new scores...")
    // Insert new scores
    const { error: insertError } = await supabase.from("user_scores").insert(userScores)

    if (insertError) {
      console.error("Error inserting scores:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log("Scores saved successfully!")
    // Format scores for response
    const formattedScores = userScores.map((score) => ({
      id: score.id,
      name: score.name,
      top10Score: score.top10_score,
      lithuaniaScore: score.lithuania_score,
      totalScore: score.total_score,
    }))

    // Sort by total score (descending)
    formattedScores.sort((a, b) => b.totalScore - a.totalScore)

    return NextResponse.json({
      success: true,
      scores: formattedScores,
    })
  } catch (error) {
    console.error("Unexpected error calculating scores:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred: " + (error.message || "Unknown error") },
      { status: 500 },
    )
  }
}
