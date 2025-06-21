export interface Question {
  id: string
  question_text: string
  hint_text: string
  answer_text: string
  long_answer_text: string
  tags: string[]
  created_at: string
}

export interface UserAnswer {
  id: string
  user_id: string
  question_id: string
  correct: boolean
  answered_at: string
  due_at: string
}