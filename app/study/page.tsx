'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Question } from '@/types/database'
import { useRouter } from 'next/navigation'

export default function StudyPage() {
  const [user, setUser] = useState<any>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dueCount, setDueCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)
      await Promise.all([
        getNextQuestion(user.id),
        getDueCount(user.id)
      ])
    }

    getUser()
  }, [router, supabase.auth])

  const getNextQuestion = async (userId: string) => {
    setLoading(true)
    try {
      // First, try to get a question that's due for review from review_state
      const { data: dueQuestions, error: dueError } = await supabase
        .from('review_state')
        .select(`
          question_id,
          due_at,
          questions (*)
        `)
        .eq('user_id', userId)
        .lte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })
        .limit(1)

      if (dueError) {
        console.error('Error fetching due questions:', dueError)
        return
      }

      if (dueQuestions && dueQuestions.length > 0) {
        setCurrentQuestion(dueQuestions[0].questions as Question)
      } else {
        // If no due questions, get a new question that hasn't been added to review_state yet 
        const { data: reviewedQuestionIds } = await supabase
          .from('review_state')
          .select('question_id')
          .eq('user_id', userId)

        const reviewedIds = reviewedQuestionIds?.map((r: any) => r.question_id) || []

        let query = supabase.from('questions').select('*')
        
        if (reviewedIds.length > 0) {
          query = query.not('id', 'in', `(${reviewedIds.join(',')})`)
        }
        
        const { data: newQuestions, error: newError } = await query.limit(1)

        if (newError) {
          console.error('Error fetching new questions:', newError)
          return
        }

        if (newQuestions && newQuestions.length > 0) {
          setCurrentQuestion(newQuestions[0])
        } else {
          // No more questions available
          setCurrentQuestion(null)
        }
      }
    } catch (error) {
      console.error('Error in getNextQuestion:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDueCount = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('review_state')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('due_at', new Date().toISOString())

      if (error) {
        console.error('Error fetching due count:', error)
        return
      }

      setDueCount(count || 0)
    } catch (error) {
      console.error('Error in getDueCount:', error)
    }
  }

  const handleAnswer = async (correct: boolean) => {
    if (!currentQuestion || !user) return

    try {
      // Submit answer - SRS calculation is now handled by the Edge Function
      const response = await fetch('/api/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          correct,
        }),
      })

      if (!response.ok) {
        console.error('Failed to submit answer')
        return
      }

      // Reset state and get next question
      setShowHint(false)
      setShowAnswer(false)
      await Promise.all([
        getNextQuestion(user.id),
        getDueCount(user.id)
      ])
    } catch (error) {
      console.error('Error submitting answer:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">All caught up!</h1>
        <p className="text-gray-600 mb-8">No questions are due for review right now.</p>
        <button
          onClick={handleSignOut}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">QuantFlash Study</h1>
            {dueCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full">
                {dueCount} due
              </span>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Question</h2>
            <p className="text-lg leading-relaxed">{currentQuestion.question_text}</p>
          </div>

          {!showHint && !showAnswer && (
            <div className="space-y-4">
              <button
                onClick={() => setShowHint(true)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Show Hint
              </button>
            </div>
          )}

          {showHint && !showAnswer && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Hint</h3>
                <p className="text-yellow-700">{currentQuestion.hint_text}</p>
              </div>
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Show Answer
              </button>
            </div>
          )}

          {showAnswer && (
            <div className="space-y-6">
              {showHint && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2">Hint</h3>
                  <p className="text-yellow-700">{currentQuestion.hint_text}</p>
                </div>
              )}
              
              <div className="bg-green-50 border-l-4 border-green-400 p-4">
                <h3 className="font-semibold text-green-800 mb-2">Answer</h3>
                <p className="text-green-700 mb-3">{currentQuestion.answer_text}</p>
                <div className="text-sm text-green-600">
                  <strong>Detailed explanation:</strong>
                  <p className="mt-1">{currentQuestion.long_answer_text}</p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => handleAnswer(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  I knew it! ✓
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  I guessed ✗
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-500">
            Tags: {currentQuestion.tags.join(', ')}
          </div>
        </div>
      </div>
    </div>
  )
}