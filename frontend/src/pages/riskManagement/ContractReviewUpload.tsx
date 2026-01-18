import React, { useState, useCallback } from 'react';
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

// Claude API integration for real contract analysis
async function analyzeContractWithClaude(contractText: string, apiKey: string) {
  const systemPrompt = `You are a contract review specialist for Tweet Garot Mechanical, a mechanical contracting company specializing in plumbing, HVAC, and piping for commercial and industrial projects. Analyze subcontracts from general contractors to identify risk factors.

Analyze the provided contract and identify risks in these categories:
- Payment Terms, Retainage, Liquidated Damages, Consequential Damages
- Indemnification, Flow-Down Provisions, Warranty, Termination
- Dispute Resolution, Notice Requirements, Change Orders, Schedule/Delays
- Insurance, Bonding, Lien Rights

For each risk found, provide:
1. category (use snake_case matching categories above)
2. title (human readable name)
3. level (HIGH, MODERATE, or LOW)
4. finding (specific text or issue from the contract)
5. recommendation (what to negotiate or change)

Also extract:
- contractValue (number, if stated)
- projectName (string)
- generalContractor (string)
- overallRisk (HIGH, MODERATE, or LOW based on findings)

Respond ONLY with valid JSON in this format:
{
  "contractValue": 1500000,
  "projectName": "Project Name",
  "generalContractor": "GC Name",
  "overallRisk": "HIGH",
  "risks": [
    {
      "category": "payment_terms",
      "title": "Payment Terms",
      "level": "MODERATE",
      "finding": "Net 45 payment terms...",
      "recommendation": "Negotiate to Net 30..."
    }
  ]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this contract and respond with JSON only:\n\n${contractText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

const ContractReviewUpload: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: ContractReview) => contractReviewsApi.create(data),
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
      const contractText = await file.text();

      let analysisResults;
      if (claudeApiKey) {
        // Real Claude API analysis
        analysisResults = await analyzeContractWithClaude(contractText, claudeApiKey);
      } else {
        // Demo mode - mock analysis
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
            },
            {
              category: 'liquidated_damages',
              title: 'Liquidated Damages',
              risk_level: 'HIGH',
              finding: 'Uncapped liquidated damages at $5,000 per day.',
              recommendation: 'Add cap at 10% of contract value.',
            },
            {
              category: 'consequential_damages',
              title: 'Consequential Damages',
              risk_level: 'HIGH',
              finding: 'No mutual waiver of consequential damages.',
              recommendation: 'Add mutual waiver clause.',
            },
            {
              category: 'indemnification',
              title: 'Indemnification',
              risk_level: 'MODERATE',
              finding: 'Broad indemnification scope including owner negligence.',
              recommendation: 'Limit indemnification to own negligence only.',
            },
          ],
        };
      }

      // Determine if legal review is needed
      const needsLegalReview =
        analysisResults.risks?.some((r: any) => r.risk_level === 'HIGH') ||
        analysisResults.contractValue > 2000000;

      // Save to database
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
      const savedReview = await createMutation.mutateAsync(reviewData);
      console.log('Contract review saved:', savedReview);

      // Only show results after successful save
      setResults(analysisResults);
    } catch (err: any) {
      console.error('Error during analysis or save:', err);
      setError(err.message || 'Failed to analyze or save contract');
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

        <div className="api-key-section">
          {!showApiKeyInput ? (
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="btn-link"
            >
              Use Claude API for real analysis (optional)
            </button>
          ) : (
            <div className="api-key-input-group">
              <input
                type="password"
                placeholder="Enter your Claude API key"
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                className="api-key-input"
              />
              <p className="api-key-note">
                Without an API key, a demo analysis will be generated
              </p>
            </div>
          )}
        </div>

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
