import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"
import { countries } from "@/lib/countries"

export async function GET() {
  console.log("API route called: GET /api/scores")

  try {
    // Get Supabase client
    const supabase = getSupabaseServerClient()

    // Get scores from the scoreboard view
    const { data: scoreData, error: scoreError } = await supabase.from("scoreboard").select("*")

    if (scoreError) {
      console.error("Error fetching scores:", scoreError)
      return NextResponse.json({ error: scoreError.message }, { status: 500 })
    }

    // Get recent voters - use a more explicit select to avoid issues with new columns
    const { data: votersData, error: votersError } = await supabase
      .from("voters")
      .select(`
        id,
        name,
        created_at,
        votes (
          country_code,
          points
        )
      `)
      .order("created_at", { ascending: false })
      .limit(10)

    if (votersError) {
      console.error("Error fetching voters:", votersError)
      return NextResponse.json({ error: votersError.message }, { status: 500 })
    }

    // Get Lithuania predictions separately to handle potential column issues
    const voterPredictions = {}
    try {
      const { data: predictionsData } = await supabase
        .from("voters")
        .select("id, lithuania_prediction")
        .in(
          "id",
          votersData.map((voter) => voter.id),
        )

      if (predictionsData) {
        predictionsData.forEach((item) => {
          if (item.lithuania_prediction) {
            voterPredictions[item.id] = item.lithuania_prediction
          }
        })
      }
    } catch (predictionError) {
      console.error("Error fetching Lithuania predictions:", predictionError)
      // Continue without predictions if there's an error
    }

    // Get voting status
    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "voting_enabled")
      .single()

    // Default to enabled if there's an error or no setting found
    let votingEnabled = true
    if (!settingsError && settingsData) {
      votingEnabled = settingsData.value === "true"
    }

    // Format scores
    const scores = scoreData.map((score) => {
      const country = countries.find((c) => c.code === score.country_code)
      return {
        code: score.country_code,
        name: country ? country.name : score.country_code,
        flag: country ? country.flag : "🏳️",
        totalPoints: score.total_points,
        pointsBreakdown: {
          "12": score.points_12,
          "10": score.points_10,
          "8": score.points_8,
          "7": score.points_7,
          "6": score.points_6,
          "5": score.points_5,
          "4": score.points_4,
          "3": score.points_3,
          "2": score.points_2,
          "1": score.points_1,
        },
      }
    })

    // Format voters
    const voters = votersData.map((voter) => {
      const votesMap = {}
      voter.votes.forEach((vote) => {
        votesMap[vote.points] = vote.country_code
      })

      return {
        id: voter.id,
        name: voter.name,
        votes: votesMap,
        lithuaniaPrediction: voterPredictions[voter.id] || null,
      }
    })

    console.log("Successfully retrieved scores and voters")
    console.log(
      "Returning scores for top countries:",
      scores
        .slice(0, 3)
        .map((c) => `${c.name}: ${c.totalPoints}`)
        .join(", "),
    )

    return NextResponse.json({
      scores,
      voters,
      votingEnabled,
    })
  } catch (error) {
    console.error("Error fetching scores:", error)
    return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 })
  }
}
