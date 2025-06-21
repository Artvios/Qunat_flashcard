import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

interface SRSRequest {
  user_id: string
  question_id: string
  quality: number // 1 = wrong/guessed, 5 = correct & easy
  answered_at: string
}

interface ReviewState {
  user_id: string
  question_id: string
  repetition: number
  interval: number
  easiness: number
  due_at: string
  updated_at: string
}

/**
 * SuperMemo-2 Algorithm Implementation
 * Maps user responses to SM-2 quality scores:
 * - "guessed" (incorrect) → quality = 1
 * - "knew it" (correct) → quality = 5
 */
function calculateSM2(currentState: Partial<ReviewState>, quality: number, answeredAt: string): ReviewState {
  let repetition = currentState.repetition || 0
  let interval = currentState.interval || 1
  let easiness = currentState.easiness || 2.5

  // SM-2 Algorithm
  if (quality < 3) {
    // Wrong answer - reset progress
    repetition = 0
    interval = 1
  } else {
    // Correct answer - advance
    if (repetition === 0) {
      interval = 1
    } else if (repetition === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easiness)
    }
    repetition += 1
  }

  // Update easiness factor
  easiness = Math.max(
    1.3,
    easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  // Calculate next due date
  const dueDate = new Date(answeredAt)
  dueDate.setDate(dueDate.getDate() + interval)

  return {
    user_id: currentState.user_id!,
    question_id: currentState.question_id!,
    repetition,
    interval,
    easiness,
    due_at: dueDate.toISOString(),
    updated_at: new Date().toISOString()
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { user_id, question_id, quality, answered_at }: SRSRequest = await req.json()

    // Validate input
    if (!user_id || !question_id || quality === undefined || !answered_at) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, question_id, quality, answered_at' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (quality < 1 || quality > 5) {
      return new Response(
        JSON.stringify({ error: 'Quality must be between 1 and 5' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get current review state
    const { data: currentState, error: fetchError } = await supabase
      .from('review_state')
      .select('*')
      .eq('user_id', user_id)
      .eq('question_id', question_id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching review state:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch review state' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate new state using SM-2 algorithm
    const newState = calculateSM2(
      currentState || { user_id, question_id },
      quality,
      answered_at
    )

    // Upsert review state
    const { data, error: upsertError } = await supabase
      .from('review_state')
      .upsert(newState, { onConflict: 'user_id,question_id' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting review state:', upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to update review state' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        algorithm: 'SM-2',
        debug: {
          previous_state: currentState,
          quality_input: quality,
          calculated_interval: newState.interval,
          next_due: newState.due_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in update_srs function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})