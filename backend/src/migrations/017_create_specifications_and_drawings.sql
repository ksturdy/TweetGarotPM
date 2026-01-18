-- Create specifications table with version tracking
CREATE TABLE specifications (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- e.g., 'HVAC', 'Mechanical', 'Electrical', etc.
  version_number VARCHAR(50) NOT NULL, -- e.g., '1.0', '2.0', 'Rev A', etc.
  is_original_bid BOOLEAN DEFAULT false,
  is_latest BOOLEAN DEFAULT true,
  parent_spec_id INTEGER REFERENCES specifications(id), -- Links to previous version
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_size INTEGER, -- in bytes
  file_type VARCHAR(50),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create specification questions table for Q&A
CREATE TABLE specification_questions (
  id SERIAL PRIMARY KEY,
  specification_id INTEGER NOT NULL REFERENCES specifications(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  asked_by INTEGER REFERENCES users(id),
  answered_by INTEGER REFERENCES users(id),
  asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'answered', 'archived'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create drawings table with version tracking
CREATE TABLE drawings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_number VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  discipline VARCHAR(100), -- e.g., 'Mechanical', 'Plumbing', 'Sheet Metal', etc.
  sheet_number VARCHAR(50),
  version_number VARCHAR(50) NOT NULL,
  is_original_bid BOOLEAN DEFAULT false,
  is_latest BOOLEAN DEFAULT true,
  parent_drawing_id INTEGER REFERENCES drawings(id),
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_size INTEGER,
  file_type VARCHAR(50),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_specifications_project_id ON specifications(project_id);
CREATE INDEX idx_specifications_is_latest ON specifications(is_latest);
CREATE INDEX idx_specification_questions_spec_id ON specification_questions(specification_id);
CREATE INDEX idx_specification_questions_status ON specification_questions(status);
CREATE INDEX idx_drawings_project_id ON drawings(project_id);
CREATE INDEX idx_drawings_is_latest ON drawings(is_latest);
CREATE INDEX idx_drawings_drawing_number ON drawings(drawing_number);
