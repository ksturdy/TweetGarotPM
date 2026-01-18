-- Migration: Create Developer Feedback System Tables
-- Created: 2026-01-18

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    submodule VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('bug', 'enhancement', 'feature_request', 'improvement', 'other')),
    status VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'read', 'under_review', 'in_progress', 'completed', 'on_hold', 'rejected')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    votes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create feedback_votes table
CREATE TABLE IF NOT EXISTS feedback_votes (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feedback_id, user_id)
);

-- Create feedback_comments table
CREATE TABLE IF NOT EXISTS feedback_comments (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_module ON feedback(module);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_count ON feedback(votes_count DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback_id ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_id ON feedback_comments(feedback_id);

-- Create function to update votes_count
CREATE OR REPLACE FUNCTION update_feedback_votes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feedback
        SET votes_count = votes_count + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END
        WHERE id = NEW.feedback_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feedback
        SET votes_count = votes_count - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE -1 END
        WHERE id = OLD.feedback_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE feedback
        SET votes_count = votes_count +
            CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END -
            CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE -1 END
        WHERE id = NEW.feedback_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to update comments_count
CREATE OR REPLACE FUNCTION update_feedback_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feedback
        SET comments_count = comments_count + 1
        WHERE id = NEW.feedback_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feedback
        SET comments_count = comments_count - 1
        WHERE id = OLD.feedback_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop first if they exist)
DROP TRIGGER IF EXISTS trigger_update_feedback_votes_count ON feedback_votes;
CREATE TRIGGER trigger_update_feedback_votes_count
    AFTER INSERT OR UPDATE OR DELETE ON feedback_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_votes_count();

DROP TRIGGER IF EXISTS trigger_update_feedback_comments_count ON feedback_comments;
CREATE TRIGGER trigger_update_feedback_comments_count
    AFTER INSERT OR DELETE ON feedback_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_comments_count();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feedback_updated_at ON feedback;
CREATE TRIGGER trigger_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_feedback_comments_updated_at ON feedback_comments;
CREATE TRIGGER trigger_feedback_comments_updated_at
    BEFORE UPDATE ON feedback_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample modules/submodules for reference (optional)
COMMENT ON COLUMN feedback.module IS 'Main module: Projects, RFIs, Submittals, Change Orders, Daily Reports, Schedule, Estimates, HR, Account Management, etc.';
COMMENT ON COLUMN feedback.submodule IS 'Specific submodule or feature area within the main module';
