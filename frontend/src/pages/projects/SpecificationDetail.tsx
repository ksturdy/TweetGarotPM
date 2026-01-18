import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specificationsApi } from '../../services/specifications';

const SpecificationDetail: React.FC = () => {
  const { id: projectId, specId } = useParams<{ id: string; specId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newQuestion, setNewQuestion] = useState('');
  const [answeringQuestion, setAnsweringQuestion] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');

  const { data: specification } = useQuery({
    queryKey: ['specification', specId],
    queryFn: () => specificationsApi.getById(Number(specId)).then(res => res.data.data),
  });

  const { data: versions } = useQuery({
    queryKey: ['specification-versions', specId],
    queryFn: () => specificationsApi.getVersionHistory(Number(specId)).then(res => res.data.data),
  });

  const { data: questions } = useQuery({
    queryKey: ['specification-questions', specId],
    queryFn: () => specificationsApi.getQuestions(Number(specId)).then(res => res.data.data),
  });

  const askMutation = useMutation({
    mutationFn: (question: string) => specificationsApi.createQuestion(Number(specId), question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specification-questions'] });
      setNewQuestion('');
    },
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) =>
      specificationsApi.answerQuestion(id, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specification-questions'] });
      setAnsweringQuestion(null);
      setAnswerText('');
    },
  });

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuestion.trim()) {
      askMutation.mutate(newQuestion);
    }
  };

  const handleAnswerQuestion = (questionId: number) => {
    if (answerText.trim()) {
      answerMutation.mutate({ id: questionId, answer: answerText });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (!specification) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/specifications`}>&larr; Back to Specifications</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{specification.title}</h1>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
            Version {specification.version_number}
            {specification.is_latest && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Latest</span>}
            {specification.is_original_bid && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Original Bid</span>}
          </div>
        </div>
        <button onClick={() => navigate(`/projects/${projectId}/specifications`)} className="btn btn-secondary">
          Close
        </button>
      </div>

      {/* Specification Details */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Specification Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div>
            <strong>Category:</strong> {specification.category || 'N/A'}
          </div>
          <div>
            <strong>Version:</strong> {specification.version_number}
          </div>
          <div>
            <strong>Uploaded By:</strong> {specification.uploaded_by_name || 'N/A'}
          </div>
          <div>
            <strong>Uploaded:</strong> {formatDate(specification.uploaded_at)}
          </div>
          {specification.file_name && (
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>File:</strong> {specification.file_name}
              {specification.file_size && <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                ({(specification.file_size / (1024 * 1024)).toFixed(2)} MB)
              </span>}
            </div>
          )}
        </div>
        {specification.description && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Description:</strong>
            <p style={{ marginTop: '0.5rem' }}>{specification.description}</p>
          </div>
        )}
        {specification.notes && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Notes:</strong>
            <p style={{ marginTop: '0.5rem' }}>{specification.notes}</p>
          </div>
        )}
      </div>

      {/* Version History */}
      {versions && versions.length > 1 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Version History</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Uploaded</th>
                <th>Uploaded By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ background: v.id === specification.id ? '#f0f9ff' : undefined }}>
                  <td>{v.version_number}</td>
                  <td>{formatDate(v.uploaded_at)}</td>
                  <td>{v.uploaded_by_name}</td>
                  <td>
                    {v.is_latest && <span className="badge badge-success">Latest</span>}
                    {v.is_original_bid && <span className="badge badge-info">Original Bid</span>}
                    {v.id === specification.id && <span className="badge badge-primary">Current</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Q&A Section */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Questions & Answers</h3>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Ask questions about this specification and receive AI-assisted answers
        </p>

        {/* Ask Question Form */}
        <form onSubmit={handleAskQuestion} style={{ marginBottom: '2rem' }}>
          <div className="form-group">
            <label className="form-label">Ask a Question</label>
            <textarea
              className="form-input"
              rows={3}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="e.g., What are the requirements for ductwork insulation in this specification?"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={askMutation.isPending || !newQuestion.trim()}>
            {askMutation.isPending ? 'Submitting...' : 'Ask Question'}
          </button>
        </form>

        {/* Questions List */}
        <div>
          {questions?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              No questions yet. Be the first to ask!
            </div>
          )}

          {questions?.map((q) => (
            <div key={q.id} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              background: q.status === 'answered' ? '#f9fafb' : '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#1f2937' }}>Q:</strong>
                  <span style={{ marginLeft: '0.5rem' }}>{q.question}</span>
                </div>
                <span className={`badge ${q.status === 'answered' ? 'badge-success' : 'badge-warning'}`}>
                  {q.status}
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                Asked by {q.asked_by_name} on {formatDate(q.asked_at)}
              </div>

              {q.answer ? (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#059669' }}>A:</strong>
                  <p style={{ marginLeft: '1.5rem', marginTop: '0.5rem', color: '#1f2937' }}>{q.answer}</p>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                    Answered by {q.answered_by_name} on {formatDate(q.answered_at)}
                  </div>
                </div>
              ) : answeringQuestion === q.id ? (
                <div style={{ marginTop: '1rem' }}>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer here..."
                  />
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleAnswerQuestion(q.id)}
                      className="btn btn-primary btn-sm"
                      disabled={answerMutation.isPending || !answerText.trim()}
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={() => {
                        setAnsweringQuestion(null);
                        setAnswerText('');
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAnsweringQuestion(q.id);
                    setAnswerText('');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  Answer Question
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpecificationDetail;
