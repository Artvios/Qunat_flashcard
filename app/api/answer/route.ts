import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { question_id, correct } = await request.json()

    if (!question_id || typeof correct !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: question_id, correct' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const answeredAt = new Date().toISOString()

    // Check if user has already answered this question
    const { data: existingAnswer } = await supabase
      .from('user_answers')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', question_id)
      .single()

    let answerData
    if (existingAnswer) {
      // Update existing answer
      const { data, error } = await supabase
        .from('user_answers')
        .update({
          correct,
          answered_at: answeredAt,
          due_at: answeredAt, // Will be overridden by SRS calculation
        })
        .eq('id', existingAnswer.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating user answer:', error)
        return NextResponse.json(
          { error: 'Failed to update answer' },
          { status: 500 }
        )
      }
      answerData = data
    } else {
      // Create new answer
      const { data, error } = await supabase
        .from('user_answers')
        .insert({
          user_id: user.id,
          question_id,
          correct,
          answered_at: answeredAt,
          due_at: answeredAt, // Will be overridden by SRS calculation
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating user answer:', error)
        return NextResponse.json(
          { error: 'Failed to create answer' },
          { status: 500 }
        )
      }
      answerData = data
    }

    // Call SRS Edge Function to update spaced repetition schedule
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const srsResponse = await fetch(`${supabaseUrl}/functions/v1/update_srs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          question_id,
          quality: correct ? 5 : 1, // Map "knew it" → 5, "guessed" → 1
          answered_at: answeredAt,
        }),
      })

      if (!srsResponse.ok) {
        console.error('SRS function failed:', await srsResponse.text())
        // Continue anyway - we still recorded the answer
      } else {
        const srsData = await srsResponse.json()
        console.log('SRS updated:', srsData)
      }
    } catch (srsError) {
      console.error('Error calling SRS function:', srsError)
      // Continue anyway - we still recorded the answer
    }

    return NextResponse.json({ 
      data: answerData,
      srs_updated: true 
    })
  } catch (error) {
    console.error('Error in answer API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}