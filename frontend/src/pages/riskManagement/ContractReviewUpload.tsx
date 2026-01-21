import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractReviewsApi, ContractReview } from '../../services/contractReviews';
import './ContractReviewUpload.css';

// Risk categories for mechanical contracting
const RISK_CATEGORIES = [
  { id: 'payment_terms', label: 'Payment Terms' },
  { id: 'retainage', label: 'Retainage' },
  { id: 'liquidated_damages', label: 'Liquidated Damages' },
  { id: 'consequential_damages', label: 'Consequential Damages' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'flow_down', label: 'Flow-Down Provisions' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'termination', label: 'Termination' },
  { id: 'dispute_resolution', label: 'Dispute Resolution' },
  { id: 'notice_requirements', label: 'Notice Requirements' },
  { id: 'change_orders', label: 'Change Orders' },
  { id: 'schedule_delays', label: 'Schedule/Delays' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'bonding', label: 'Bonding' },
  { id: 'lien_rights', label: 'Lien Rights' },
];

// Call backend proxy for Claude API analysis
async function analyzeContractWithClaude(contractText: string, apiKey: string, pageTexts?: Array<{page: number, text: string}>) {
  try {
    // Get JWT token from localStorage
    const token = localStorage.getItem('token');
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

    console.log('[analyzeContractWithClaude] Starting request...');
    console.log('[analyzeContractWithClaude] Contract text length:', contractText.length);
    console.log('[analyzeContractWithClaude] Number of pages:', pageTexts?.length || 0);

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    try {
      const response = await fetch(`${apiUrl}/contract-reviews/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          contractText,
          pageTexts,
          apiKey,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[analyzeContractWithClaude] Error response:', errorData);
        throw new Error(errorData.error || errorData.details || `Analysis failed (${response.status})`);
      }

      const result = await response.json();
      console.log('[analyzeContractWithClaude] Success:', result);
      return result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out after 5 minutes. Please try with a smaller contract or contact support.');
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[analyzeContractWithClaude] Error:', error);
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Unable to connect to server. Please check your connection.');
    }
    throw error;
  }
}

const ContractReviewUpload: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [claudeApiKey, setClaudeApiKey] = useState(() => {
    // Load API key from localStorage on initial render
    return localStorage.getItem('claudeApiKey') || '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [serverHasKey, setServerHasKey] = useState(false);

  // Check if server has Claude API key configured
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
    fetch(`${apiUrl}/contract-reviews/claude-config`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log('[ContractReviewUpload] Server has key:', data.hasServerKey);
        setServerHasKey(data.hasServerKey);
      })
      .catch(err => console.error('Failed to check Claude config:', err));
  }, []);

  // Save API key to localStorage whenever it changes
  useEffect(() => {
    if (claudeApiKey) {
      localStorage.setItem('claudeApiKey', claudeApiKey);
    } else {
      localStorage.removeItem('claudeApiKey');
    }
  }, [claudeApiKey]);

  const createMutation = useMutation({
    mutationFn: ({ data, file }: { data: ContractReview; file?: File }) =>
      contractReviewsApi.create(data, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractReviews'] });
      queryClient.invalidateQueries({ queryKey: ['contractReviewStats'] });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const analyzeContract = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);

    try {
      let contractText = '';
      let pageTexts: Array<{page: number, text: string}> = [];

      // Extract text based on file type
      const isPDF = file.name.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        // Extract PDF text with page tracking using pdf.js
        const pdfjsLib = await import('pdfjs-dist');
        // Use local worker file that matches the library version
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const textParts: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');

          pageTexts.push({ page: pageNum, text: pageText });
          textParts.push(pageText);
        }

        contractText = textParts.join('\n\n');
      } else {
        // For text files
        contractText = await file.text();
      }

      let analysisResults;
      console.log('[ContractReviewUpload] Analysis decision - claudeApiKey:', !!claudeApiKey, 'serverHasKey:', serverHasKey);
      if (claudeApiKey || serverHasKey) {
        // Real Claude API analysis with page tracking
        // Pass claudeApiKey (may be empty string) - backend will use server key if user key is empty
        console.log('[ContractReviewUpload] Using real Claude API analysis');
        analysisResults = await analyzeContractWithClaude(contractText, claudeApiKey, pageTexts.length > 0 ? pageTexts : undefined);
      } else {
        // Demo mode - mock analysis with realistic data
        console.log('[ContractReviewUpload] Using demo mode - no API key available');
        const isPDF = file.name.toLowerCase().endsWith('.pdf');
        analysisResults = {
          contractValue: Math.floor(Math.random() * 5000000) + 500000,
          projectName: file.name.replace(/\.[^/.]+$/, ''),
          generalContractor: ['Turner', 'McCarthy', 'DPR', 'Hensel Phelps'][
            Math.floor(Math.random() * 4)
          ],
          overallRisk: Math.random() > 0.5 ? 'HIGH' : 'MODERATE',
          risks: [
            {
              category: 'payment_terms',
              title: 'Payment Terms',
              risk_level: 'MODERATE',
              finding: 'Net 45 payment terms identified.',
              recommendation: 'Negotiate to Net 30 standard terms.',
              page_number: isPDF ? 1 : null,
              quoted_text: 'Payment shall be made within forty-five (45) days',
            },
            {
              category: 'liquidated_damages',
              title: 'Liquidated Damages',
              risk_level: 'HIGH',
              finding: 'Uncapped liquidated damages at $5,000 per day.',
              recommendation: 'Add cap at 10% of contract value.',
              page_number: isPDF ? 2 : null,
              quoted_text: 'liquidated damages of Five Thousand Dollars ($5,000) per day',
            },
            {
              category: 'consequential_damages',
              title: 'Consequential Damages',
              risk_level: 'HIGH',
              finding: 'No mutual waiver of consequential damages.',
              recommendation: 'Add mutual waiver clause.',
              page_number: isPDF ? 3 : null,
              quoted_text: 'consequential damages',
            },
            {
              category: 'indemnification',
              title: 'Indemnification',
              risk_level: 'MODERATE',
              finding: 'Broad indemnification scope including owner negligence.',
              recommendation: 'Limit indemnification to own negligence only.',
              page_number: isPDF ? 2 : null,
              quoted_text: 'indemnify and hold harmless',
            },
          ],
        };
      }

      // Determine if legal review is needed
      const needsLegalReview =
        analysisResults.risks?.some((r: any) => r.risk_level === 'HIGH') ||
        analysisResults.contractValue > 2000000;

      // Save to database with file upload
      const reviewData: ContractReview = {
        file_name: file.name,
        file_size: file.size,
        project_name: analysisResults.projectName,
        general_contractor: analysisResults.generalContractor,
        contract_value: analysisResults.contractValue,
        overall_risk: analysisResults.overallRisk,
        status: needsLegalReview ? 'pending' : 'approved',
        needs_legal_review: needsLegalReview,
        findings: analysisResults.risks,
      };

      console.log('Saving contract review:', reviewData);
      const savedReview = await createMutation.mutateAsync({
        data: reviewData,
        file
      });
      console.log('Contract review saved:', savedReview);

      // Only show results after successful save
      setResults(analysisResults);
    } catch (err: any) {
      console.error('Error during analysis or save:', err);
      console.error('Error response data:', err.response?.data);
      console.error('Error response status:', err.response?.status);
      console.error('Error message:', err.message);
      // For Axios errors, the server's error message is in err.response.data
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to analyze or save contract';
      console.error('Extracted error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  if (results) {
    const highRisks = results.risks?.filter((r: any) => r.risk_level === 'HIGH').length || 0;
    const moderateRisks = results.risks?.filter((r: any) => r.risk_level === 'MODERATE').length || 0;
    const lowRisks = results.risks?.filter((r: any) => r.risk_level === 'LOW').length || 0;

    return (
      <div className="contract-upload">
        <div className="results-container">
          <div className="results-header">
            <h2>Analysis Complete</h2>
            <span className={`risk-badge risk-${results.overallRisk?.toLowerCase()}`}>
              {results.overallRisk} RISK
            </span>
          </div>

          <div className="results-summary">
            <div className="summary-item">
              <span className="summary-label">Document</span>
              <strong>{file?.name}</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Project</span>
              <strong>{results.projectName || '—'}</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">General Contractor</span>
              <strong>{results.generalContractor || '—'}</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Contract Value</span>
              <strong>
                {results.contractValue
                  ? `$${results.contractValue.toLocaleString()}`
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="risk-counts">
            <div className="risk-count high">
              <span className="count">{highRisks}</span>
              <span className="label">High Risk</span>
            </div>
            <div className="risk-count moderate">
              <span className="count">{moderateRisks}</span>
              <span className="label">Moderate Risk</span>
            </div>
            <div className="risk-count low">
              <span className="count">{lowRisks}</span>
              <span className="label">Low Risk</span>
            </div>
          </div>

          <h3>Risk Findings</h3>
          <div className="findings-list">
            {results.risks?.map((risk: any, i: number) => (
              <details key={i} className="finding-item">
                <summary>
                  <span className={`finding-badge risk-${risk.risk_level?.toLowerCase()}`}>
                    {risk.risk_level}
                  </span>
                  <span className="finding-title">{risk.title}</span>
                </summary>
                <div className="finding-content">
                  <div className="finding-section">
                    <strong>Finding:</strong>
                    <p>{risk.finding}</p>
                  </div>
                  <div className="finding-section">
                    <strong>Recommendation:</strong>
                    <p>{risk.recommendation}</p>
                  </div>
                </div>
              </details>
            ))}
          </div>

          <div className="results-actions">
            <button
              onClick={() => {
                setFile(null);
                setResults(null);
              }}
              className="btn btn-secondary"
            >
              Upload Another
            </button>
            <button
              onClick={() => navigate('/risk-management/contract-reviews')}
              className="btn btn-primary"
            >
              View All Reviews
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contract-upload">
      <div className="page-header">
        <h1>Upload Contract for Analysis</h1>
        <p>AI-powered risk analysis for mechanical contracting agreements</p>
      </div>

      <div className="upload-container">
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            type="file"
            id="file-input"
            hidden
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
          />
          <div className="dropzone-icon">⬆️</div>
          <p className="dropzone-text">Drag and drop your contract</p>
          <p className="dropzone-subtext">or click to browse • PDF, DOCX, TXT (max 50MB)</p>
        </div>

        {file && (
          <div className="file-preview">
            <span className="file-icon">📄</span>
            <span className="file-info">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
            <button onClick={() => setFile(null)} className="file-remove">
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {!claudeApiKey && !serverHasKey && (
          <div className="warning-banner" style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#856404'
          }}>
            <strong>⚠️ Demo Mode</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Without a Claude API key, this will generate random demo data with inaccurate findings.
              For real contract analysis, enter your API key below.
            </p>
          </div>
        )}

        {serverHasKey && (
          <div className="warning-banner" style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#155724'
          }}>
            <strong>✓ AI Analysis Enabled</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              This application is configured with Claude AI for accurate contract analysis.
            </p>
          </div>
        )}

        {!serverHasKey && (
          <div className="api-key-section">
            {!showApiKeyInput ? (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="btn-link"
              >
                Use Claude API for accurate analysis (enter API key)
              </button>
            ) : (
              <div className="api-key-input-group">
                <input
                  type="password"
                  placeholder="Enter your Claude API key (from console.anthropic.com)"
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  className="api-key-input"
                />
                {claudeApiKey && (
                  <p className="api-key-note" style={{ color: '#28a745' }}>
                    ✓ API key entered - will use real AI analysis
                  </p>
                )}
                {!claudeApiKey && (
                  <p className="api-key-note">
                    Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {analyzing && (
          <div className="analyzing-overlay">
            <div className="spinner"></div>
            <p>Analyzing contract...</p>
            <p className="analyzing-subtext">This may take a few moments</p>
          </div>
        )}

        <button
          className="btn btn-primary btn-large"
          disabled={!file || analyzing}
          onClick={analyzeContract}
        >
          {analyzing ? 'Analyzing...' : 'Analyze Contract'}
        </button>
      </div>
    </div>
  );
};

export default ContractReviewUpload;
