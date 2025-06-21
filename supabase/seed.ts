import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface SeedQuestion {
  id: string
  question_text: string
  hint_text: string
  answer_text: string
  Long_answer_text: string
  tags: string[]
}

async function seedQuestions() {
  try {
    // Read the seed data file
    const seedDataPath = path.join(process.cwd(), 'seed_data.json')
    const seedData: SeedQuestion[] = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'))

    console.log(`Found ${seedData.length} questions to seed`)

    // Transform the data to match our database schema
    const questionsToInsert = seedData.map(q => ({
      id: q.id,
      question_text: q.question_text,
      hint_text: q.hint_text,
      answer_text: q.answer_text,
      long_answer_text: q.Long_answer_text, // Note: mapping from Long_answer_text to long_answer_text
      tags: q.tags
    }))

    // Clear existing questions first
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

    if (deleteError) {
      console.error('Error clearing existing questions:', deleteError)
      return
    }

    // Insert new questions
    const { data, error } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select()

    if (error) {
      console.error('Error seeding questions:', error)
      return
    }

    console.log(`Successfully seeded ${data?.length || 0} questions`)
  } catch (error) {
    console.error('Error reading seed file or seeding data:', error)
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedQuestions()
    .then(() => {
      console.log('Seeding completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}

export { seedQuestions }