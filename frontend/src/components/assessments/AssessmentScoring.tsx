import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentsApi, AssessmentCriteria, CustomerAssessment } from '../../services/assessments';
import './AssessmentScoring.css';

interface AssessmentScoringProps {
  customerId: number;
  customerName: string;
  onClose: () => void;
}

interface CriterionConfig {
  key: keyof AssessmentCriteria;
  label: string;
  maxPoints: number;
  isKnockout?: boolean;
}

interface CategoryConfig {
  title: string;
  icon: string;
  maxPoints: number;
  criteria: CriterionConfig[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    title: 'Facility Profile',
    icon: '🏭',
    maxPoints: 25,
    criteria: [
      { key: 'facilitySize', label: 'Facility Size: 100K+ sq ft or $500M+ revenue', maxPoints: 10 },
      { key: 'complexSystems', label: 'Complex Systems: Process cooling, clean rooms, mission-critical HVAC', maxPoints: 10 },
      { key: 'multiShiftOps', label: 'Multi-Shift Operations: 24/7 or multi-shift operations', maxPoints: 5 },
    ],
  },
  {
    title: 'Decision Authority',
    icon: '👤',
    maxPoints: 25,
    criteria: [
      { key: 'directContractorSelection', label: 'Direct Contractor Selection: Owner selects contractors (not GC-driven)', maxPoints: 15, isKnockout: true },
      { key: 'accessToDecisionMaker', label: 'Access to Decision Maker: Facilities/Eng Manager or Plant Manager', maxPoints: 10 },
    ],
  },
  {
    title: 'Values Alignment',
    icon: '🎯',
    maxPoints: 20,
    criteria: [
      { key: 'qualityOverPrice', label: 'Quality Over Price: Values reliability/expertise over low bid', maxPoints: 10, isKnockout: true },
      { key: 'safetyCulture', label: 'Safety Culture: Strong safety culture and compliance expectations', maxPoints: 5 },
      { key: 'uptimeCriticality', label: 'Uptime Criticality: Downtime = major financial impact', maxPoints: 5 },
    ],
  },
  {
    title: 'Strategic Fit',
    icon: '⭐',
    maxPoints: 20,
    criteria: [
      { key: 'prioritySector', label: 'Priority Sector: Food/Bev, Pharma, Data Centers, Manufacturing, Cold Storage', maxPoints: 10 },
      { key: 'longTermPotential', label: 'Long-Term Potential: Multi-site portfolio or planned expansions', maxPoints: 10 },
    ],
  },
  {
    title: 'Opportunity Factors',
    icon: '💡',
    maxPoints: 10,
    criteria: [
      { key: 'wisconsinConnection', label: 'Wisconsin Connection: HQ/major ops in WI (bonus)', maxPoints: 5 },
      { key: 'frustratedWithCurrent', label: 'Frustrated with Current: Dissatisfied with current MEP contractor (bonus)', maxPoints: 5 },
    ],
  },
];

const AssessmentScoring: React.FC<AssessmentScoringProps> = ({ customerId, customerName, onClose }) => {
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.title)));
  const [notes, setNotes] = useState('');
  const [criteria, setCriteria] = useState<AssessmentCriteria>({
    facilitySize: 0,
    complexSystems: 0,
    multiShiftOps: 0,
    directContractorSelection: 0,
    accessToDecisionMaker: 0,
    qualityOverPrice: 0,
    safetyCulture: 0,
    uptimeCriticality: 0,
    prioritySector: 0,
    longTermPotential: 0,
    wisconsinConnection: 0,
    frustratedWithCurrent: 0,
  });

  // Load existing assessment
  const { data: existingAssessment } = useQuery({
    queryKey: ['assessment', customerId],
    queryFn: () => assessmentsApi.getCurrent(customerId),
    retry: false,
  });

  useEffect(() => {
    if (existingAssessment?.data) {
      setCriteria(existingAssessment.data.criteria);
      setNotes(existingAssessment.data.notes || '');
    }
  }, [existingAssessment]);

  // Calculate scores
  const { totalScore, knockout, knockoutReason, verdict, tier } = useMemo(() => {
    let total = 0;
    let isKnockout = false;
    let reason = '';

    // Check knockout criteria
    if (criteria.directContractorSelection === 0) {
      isKnockout = true;
      reason = 'No direct contractor selection authority';
    } else if (criteria.qualityOverPrice === 0) {
      isKnockout = true;
      reason = 'Does not prioritize quality over price';
    }

    // Calculate total score
    CATEGORIES.forEach(category => {
      category.criteria.forEach(criterion => {
        total += criteria[criterion.key];
      });
    });

    // Determine verdict
    let resultVerdict: 'GO' | 'MAYBE' | 'NO_GO' = 'NO_GO';
    if (isKnockout) {
      resultVerdict = 'NO_GO';
    } else if (total >= 70) {
      resultVerdict = 'GO';
    } else if (total >= 50) {
      resultVerdict = 'MAYBE';
    }

    // Determine tier
    let resultTier: 'A' | 'B' | 'C' | undefined;
    if (!isKnockout) {
      if (total >= 85) resultTier = 'A';
      else if (total >= 70) resultTier = 'B';
      else if (total >= 50) resultTier = 'C';
    }

    return {
      totalScore: total,
      knockout: isKnockout,
      knockoutReason: reason,
      verdict: resultVerdict,
      tier: resultTier,
    };
  }, [criteria]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const assessmentData = {
        totalScore,
        verdict,
        tier,
        knockout,
        knockoutReason: knockout ? knockoutReason : undefined,
        criteria,
        notes,
      };

      if (existingAssessment?.data?.id) {
        return assessmentsApi.update(customerId, existingAssessment.data.id, assessmentData);
      } else {
        return assessmentsApi.create(customerId, assessmentData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment', customerId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-assessments'] });
      alert('Assessment saved successfully!');
      onClose();
    },
    onError: (error: any) => {
      console.error('Failed to save assessment:', error);
      alert('Failed to save assessment: ' + (error?.response?.data?.error || error.message));
    },
  });

  const toggleCategory = (title: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedCategories(newExpanded);
  };

  const setCriterion = (key: keyof AssessmentCriteria, value: number) => {
    setCriteria(prev => ({ ...prev, [key]: value }));
  };

  const getVerdictColor = () => {
    if (knockout) return '#dc3545';
    if (verdict === 'GO') return '#28a745';
    if (verdict === 'MAYBE') return '#ffc107';
    return '#dc3545';
  };

  const getVerdictLabel = () => {
    if (knockout) return 'KNOCKOUT';
    return verdict.replace('_', ' ');
  };

  const copySummary = () => {
    const summary = `
Customer Assessment: ${customerName}
Total Score: ${totalScore}/100
Verdict: ${getVerdictLabel()}
${tier ? `Tier: ${tier}` : ''}
${knockout ? `⚠️ KNOCKOUT: ${knockoutReason}` : ''}

Category Breakdown:
${CATEGORIES.map(cat => {
  const catScore = cat.criteria.reduce((sum, c) => sum + criteria[c.key], 0);
  return `${cat.icon} ${cat.title}: ${catScore}/${cat.maxPoints}`;
}).join('\n')}

${notes ? `\nNotes:\n${notes}` : ''}
`.trim();

    navigator.clipboard.writeText(summary);
    alert('Summary copied to clipboard!');
  };

  return (
    <div className="assessment-overlay">
      <div className="assessment-modal">
        <div className="assessment-header">
          <h2>Go/No-Go Assessment: {customerName}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="assessment-body">
          {/* Score Display */}
          <div className="score-display">
            <div className="score-circle" style={{ borderColor: getVerdictColor() }}>
              <div className="score-value" style={{ color: getVerdictColor() }}>
                {totalScore}
              </div>
              <div className="score-label">/ 100</div>
            </div>
            <div className="verdict-info">
              <div className={`verdict-badge verdict-${verdict.toLowerCase()}`}>
                {getVerdictLabel()}
              </div>
              {tier && <div className={`tier-badge tier-${tier.toLowerCase()}`}>Tier {tier}</div>}
              {knockout && (
                <div className="knockout-warning">
                  <span className="knockout-icon">⚠️</span>
                  <span>{knockoutReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Criteria Categories */}
          <div className="criteria-categories">
            {CATEGORIES.map(category => {
              const categoryScore = category.criteria.reduce((sum, c) => sum + criteria[c.key], 0);
              const isExpanded = expandedCategories.has(category.title);

              return (
                <div key={category.title} className="category-card">
                  <div className="category-header" onClick={() => toggleCategory(category.title)}>
                    <div className="category-title">
                      <span className="category-icon">{category.icon}</span>
                      <span>{category.title}</span>
                      <span className="category-score">
                        {categoryScore}/{category.maxPoints}
                      </span>
                    </div>
                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                  </div>

                  {isExpanded && (
                    <div className="category-criteria">
                      {category.criteria.map(criterion => (
                        <div key={criterion.key} className="criterion-row">
                          <div className="criterion-label">
                            {criterion.label}
                            {criterion.isKnockout && <span className="knockout-indicator">⚠️ KNOCKOUT</span>}
                          </div>
                          <div className="criterion-toggle">
                            <button
                              className={`toggle-btn ${criteria[criterion.key] === 0 ? 'active' : ''}`}
                              onClick={() => setCriterion(criterion.key, 0)}
                              title="No"
                            >
                              ✗
                            </button>
                            <button
                              className={`toggle-btn ${criteria[criterion.key] === Math.floor(criterion.maxPoints / 2) ? 'active' : ''}`}
                              onClick={() => setCriterion(criterion.key, Math.floor(criterion.maxPoints / 2))}
                              title="Partial"
                            >
                              ½
                            </button>
                            <button
                              className={`toggle-btn ${criteria[criterion.key] === criterion.maxPoints ? 'active' : ''}`}
                              onClick={() => setCriterion(criterion.key, criterion.maxPoints)}
                              title="Yes"
                            >
                              ✓
                            </button>
                            <span className="criterion-points">{criteria[criterion.key]} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div className="notes-section">
            <label htmlFor="assessment-notes">Field Notes</label>
            <textarea
              id="assessment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional observations, context, or recommendations..."
              rows={4}
            />
          </div>
        </div>

        <div className="assessment-footer">
          <div className="footer-actions-left">
            <button className="btn-secondary" onClick={copySummary}>
              📋 Copy Summary
            </button>
          </div>
          <div className="footer-actions-right">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentScoring;
