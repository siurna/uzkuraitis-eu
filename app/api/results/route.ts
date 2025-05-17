import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    // Get the saved results
    const { data: resultsData, error: resultsError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "final_results")
      .single()

    if (resultsError && resultsError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine for a new app
      console.error("Error fetching results:", resultsError)
      return NextResponse.json({ error: resultsError.message }, { status: 500 })
    }

    // Try to get scores from user_scores table first
    let scores = []
    let tableExists = true

    try {
      const { data: scoresData, error: scoresError } = await supabase
        .from("user_scores")
        .select("*")
        .order("total_score", { ascending: false })

      if (scoresError) {
        console.log("Error fetching from user_scores table, it might not exist:", scoresError.message)
        tableExists = false
      } else if (scoresData) {
        // Format the scores
        scores = scoresData.map((score) => ({
          id: score.id,
          name: score.name,
          top10Score: score.top10_score,
          lithuaniaScore: score.lithuania_score,
          totalScore: score.total_score,
        }))
      }
    } catch (error) {
      console.log("Error accessing user_scores table:", error)
      tableExists = false
    }

    // If user_scores table doesn't exist or had an error, try to get scores from settings table
    if (!tableExists || scores.length === 0) {
      try {
        const { data: settingsData, error: settingsError } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "user_scores")
          .single()

        if (!settingsError && settingsData && settingsData.value) {
          try {
            scores = JSON.parse(settingsData.value)
          } catch (parseError) {
            console.error("Error parsing user_scores from settings:", parseError)
          }
        }
      } catch (error) {
        console.log("Error fetching user_scores from settings:", error)
      }
    }

    return NextResponse.json({
      results: resultsData?.value ? JSON.parse(resultsData.value) : null,
      scores,
    })
  } catch (error) {
    console.error("Unexpected error fetching results:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  console.log("API route called: POST /api/results")

  try {
    // Parse request body
    let body
    try {
      body = await request.json()
      console.log("Received results data:", JSON.stringify(body, null, 2))
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { results, password } = body

    // Check password
    if (password !== "👀👀👀") {
      console.log("Unauthorized attempt: incorrect password")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Validate results
    if (!results || !Array.isArray(results.top10)) {
      console.error("Invalid results format:", results)
      return NextResponse.json({ error: "Invalid results format" }, { status: 400 })
    }

    // The lithuaniaPlace can be empty for reset operations
    if (results.lithuaniaPlace === undefined) {
      console.error("Missing lithuaniaPlace:", results)
      return NextResponse.json({ error: "Missing lithuaniaPlace field" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    console.log("Saving results to database...")

    // Save the results
    const { error } = await supabase.from("settings").upsert(
      {
        key: "final_results",
        value: JSON.stringify(results),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    )

    if (error) {
      console.error("Error saving results:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("Results saved successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error saving results:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
