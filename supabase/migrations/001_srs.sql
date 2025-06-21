-- Create review_state table for spaced repetition system
CREATE TABLE review_state (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    repetition INTEGER DEFAULT 0,
    interval INTEGER DEFAULT 1,
    easiness FLOAT DEFAULT 2.5,
    due_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (user_id, question_id)
);

-- Create indexes for better performance
CREATE INDEX idx_review_state_user_due ON review_state(user_id, due_at);
CREATE INDEX idx_review_state_due_at ON review_state(due_at);

-- Enable Row Level Security
ALTER TABLE review_state ENABLE ROW LEVEL SECURITY;

-- Create policies for review_state (users can only see their own state)
CREATE POLICY "Users can view own review state" ON review_state
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review state" ON review_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review state" ON review_state
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_review_state_updated_at 
    BEFORE UPDATE ON review_state 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();