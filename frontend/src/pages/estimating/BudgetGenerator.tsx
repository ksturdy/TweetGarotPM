import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { budgetGeneratorService, BudgetOptions, GeneratedBudget, SimilarProject } from '../../services/budgetGenerator';
import { budgetsApi, Budget } from '../../services/budgets';
import BudgetReportModal from '../../components/estimates/BudgetReportModal';
import './BudgetGenerator.css';
import '../../styles/SalesPipeline.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface EditableValues {
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
  sectionAdjustments: { [key: string]: number }; // percentage adjustments per section
  excludedSections: { [key: string]: boolean }; // sections excluded from budget
  customAssumptions: string[] | null; // null = use generated, array = user override
  customRisks: string[] | null; // null = use generated, array = user override
}

const BudgetGenerator: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [projectType, setProjectType] = useState('');
  const [bidType, setBidType] = useState('');
  const [location, setLocation] = useState('');
  const [sqft, setSqft] = useState('');
  const [scope, setScope] = useState('');

  // Options for dropdowns
  const [options, setOptions] = useState<BudgetOptions>({
    buildingTypes: [],
    projectTypes: [],
    bidTypes: []
  });

  // Preview state
  const [previewProjects, setPreviewProjects] = useState<any[]>([]);
  const [previewAverages, setPreviewAverages] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  // Results state
  const [budget, setBudget] = useState<GeneratedBudget | null>(null);
  const [comparableProjects, setComparableProjects] = useState<SimilarProject[]>([]);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableValues, setEditableValues] = useState<EditableValues>({
    overheadPercent: 10,
    profitPercent: 10,
    contingencyPercent: 5,
    sectionAdjustments: {},
    excludedSections: {},
    customAssumptions: null,
    customRisks: null
  });
  const [adjustedBudget, setAdjustedBudget] = useState<GeneratedBudget | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Ref for print
  const reportRef = useRef<HTMLDivElement>(null);

  // Load dropdown options on mount
  useEffect(() => {
    loadOptions();
  }, []);

  // Load existing budget if editing
  useEffect(() => {
    if (id) {
      loadExistingBudget(parseInt(id, 10));
    }
  }, [id]);

  const loadExistingBudget = async (budgetId: number) => {
    try {
      setLoadingExisting(true);
      const response = await budgetsApi.getById(budgetId);
      const existingBudget = response.data;

      // Populate form fields
      setProjectName(existingBudget.project_name || '');
      setBuildingType(existingBudget.building_type || '');
      setProjectType(existingBudget.project_type || '');
      setBidType(existingBudget.bid_type || '');
      setSqft(existingBudget.square_footage?.toString() || '');
      setScope(existingBudget.scope_notes || '');

      // Populate editable values
      setEditableValues({
        overheadPercent: existingBudget.overhead_percent || 10,
        profitPercent: existingBudget.profit_percent || 10,
        contingencyPercent: existingBudget.contingency_percent || 5,
        sectionAdjustments: {},
        excludedSections: {},
        customAssumptions: null,
        customRisks: null
      });

      // Reconstruct the budget object for display
      const reconstructedBudget: GeneratedBudget = {
        summary: {
          projectName: existingBudget.project_name,
          buildingType: existingBudget.building_type,
          projectType: existingBudget.project_type,
          squareFootage: Number(existingBudget.square_footage) || 0,
          estimatedTotalCost: Number(existingBudget.grand_total) || 0,
          costPerSquareFoot: Number(existingBudget.cost_per_sqft) || 0,
          confidenceLevel: existingBudget.confidence_level,
          methodology: existingBudget.methodology || ''
        },
        totals: {
          laborSubtotal: Number(existingBudget.labor_subtotal) || 0,
          materialSubtotal: Number(existingBudget.material_subtotal) || 0,
          equipmentSubtotal: Number(existingBudget.equipment_subtotal) || 0,
          subcontractSubtotal: Number(existingBudget.subcontract_subtotal) || 0,
          directCostSubtotal: Number(existingBudget.direct_cost_subtotal) || 0,
          overhead: Number(existingBudget.overhead) || 0,
          profit: Number(existingBudget.profit) || 0,
          contingency: Number(existingBudget.contingency) || 0,
          grandTotal: Number(existingBudget.grand_total) || 0
        },
        sections: existingBudget.sections || [],
        assumptions: existingBudget.assumptions || [],
        risks: existingBudget.risks || [],
        comparableProjects: (existingBudget.comparable_projects || []).map((p: any) => ({
          name: p.name,
          sqft: Number(p.square_footage) || 0,
          totalCost: Number(p.total_cost) || 0,
          costPerSqft: Number(p.cost_per_sqft) || 0,
          relevanceNote: ''
        }))
      };

      setBudget(reconstructedBudget);

      // Load comparable projects if available
      if (existingBudget.comparable_projects) {
        setComparableProjects(existingBudget.comparable_projects.map((p: any) => ({
          id: p.id || 0,
          name: p.name,
          buildingType: existingBudget.building_type,
          projectType: existingBudget.project_type,
          sqft: Number(p.square_footage) || 0,
          totalCost: Number(p.total_cost) || 0,
          costPerSqft: Number(p.cost_per_sqft) || 0,
          similarityScore: Number(p.similarity_score) || 0
        })));
      }

      // Expand summary section
      setExpandedSections({ 'summary': true });

    } catch (err: any) {
      console.error('Error loading budget:', err);
      setError('Failed to load budget. It may have been deleted.');
    } finally {
      setLoadingExisting(false);
    }
  };

  const loadOptions = async () => {
    try {
      const opts = await budgetGeneratorService.getOptions();
      setOptions(opts);
    } catch (err) {
      console.error('Error loading options:', err);
      setError('Failed to load options. Please try again.');
    }
  };

  // Load preview when form changes - requires at least one of buildingType or projectType
  useEffect(() => {
    if (buildingType || projectType) {
      loadPreview();
    } else {
      setShowPreview(false);
      setPreviewProjects([]);
      setPreviewAverages(null);
    }
  }, [buildingType, projectType, bidType, sqft]);

  const loadPreview = async () => {
    try {
      setPreviewLoading(true);
      const result = await budgetGeneratorService.findSimilar({
        buildingType: buildingType || undefined,
        projectType: projectType || undefined,
        bidType: bidType || undefined,
        sqft: sqft ? parseFloat(sqft) : undefined
      });
      setPreviewProjects(result.similarProjects);
      setPreviewAverages(result.averages);
      setShowPreview(true);
      // Auto-select top 3 projects by default
      setSelectedProjectIds(
        result.similarProjects.slice(0, 3).map((p: any) => p.id).filter(Boolean)
      );
    } catch (err) {
      console.error('Error loading preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Track if user has made edits (to avoid recalculating on initial edit mode entry)
  const [hasUserEdited, setHasUserEdited] = useState(false);

  // Recalculate adjusted budget only when user actually changes values
  useEffect(() => {
    if (budget && isEditMode && hasUserEdited) {
      calculateAdjustedBudget();
    }
  }, [editableValues]);

  // Reset hasUserEdited when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setHasUserEdited(false);
    }
  }, [isEditMode]);

  const calculateAdjustedBudget = () => {
    if (!budget) return;

    // Calculate overall adjustment multiplier based on non-excluded section adjustments
    const includedSections = budget.sections.filter(s => !editableValues.excludedSections[s.name]);
    const sectionMultipliers = includedSections.map(section => {
      const adjustment = editableValues.sectionAdjustments[section.name] || 0;
      return 1 + (adjustment / 100);
    });
    const avgMultiplier = sectionMultipliers.length > 0
      ? sectionMultipliers.reduce((a, b) => a + b, 0) / sectionMultipliers.length
      : 1;

    // Calculate adjusted section costs
    const adjustedSections = budget.sections.map(section => {
      const isExcluded = editableValues.excludedSections[section.name];
      const adjustment = editableValues.sectionAdjustments[section.name] || 0;
      const multiplier = isExcluded ? 0 : 1 + (adjustment / 100);

      const adjustedItems = section.items.map(item => ({
        ...item,
        laborCost: (item.laborCost || 0) * multiplier,
        materialCost: (item.materialCost || 0) * multiplier,
        totalCost: item.totalCost * multiplier
      }));

      return {
        ...section,
        items: adjustedItems,
        subtotal: section.subtotal * multiplier
      };
    });

    // Calculate new totals using section subtotals as the source of truth
    // Section subtotals include all costs (labor, material, equipment) so they ARE the direct cost
    const directCostSubtotal = adjustedSections.reduce((sum, s) => sum + s.subtotal, 0);
    // Labor/material/equipment/subcontract breakdown from items (for display only)
    const laborSubtotal = adjustedSections.reduce((sum, s) =>
      sum + s.items.reduce((isum, i) => isum + (i.laborCost || 0), 0), 0);
    const materialSubtotal = adjustedSections.reduce((sum, s) =>
      sum + s.items.reduce((isum, i) => isum + (i.materialCost || 0), 0), 0);
    const equipmentSubtotal = budget.totals.equipmentSubtotal * avgMultiplier;
    const subcontractSubtotal = budget.totals.subcontractSubtotal * avgMultiplier;

    const overhead = directCostSubtotal * (editableValues.overheadPercent / 100);
    const profit = directCostSubtotal * (editableValues.profitPercent / 100);
    const contingency = directCostSubtotal * (editableValues.contingencyPercent / 100);
    const grandTotal = directCostSubtotal + overhead + profit + contingency;

    // Build assumptions: use custom if user has edited, otherwise auto-generate from edits
    let adjustedAssumptions: string[];
    if (editableValues.customAssumptions !== null) {
      adjustedAssumptions = [...editableValues.customAssumptions];
    } else {
      adjustedAssumptions = [...budget.assumptions];
      const excludedNames = Object.entries(editableValues.excludedSections)
        .filter(([, excluded]) => excluded)
        .map(([name]) => name);
      if (excludedNames.length > 0) {
        const filtered = adjustedAssumptions.filter(a => {
          const lower = a.toLowerCase();
          return !excludedNames.some(name => lower.includes(name.toLowerCase()));
        });
        filtered.push(`Excluded from scope: ${excludedNames.join(', ')}`);
        adjustedAssumptions = filtered;
      }
      const adjustedSectionNames = Object.entries(editableValues.sectionAdjustments)
        .filter(([name, val]) => val !== 0 && !editableValues.excludedSections[name])
        .map(([name, val]) => `${name} (${val >= 0 ? '+' : ''}${val}%)`);
      if (adjustedSectionNames.length > 0) {
        adjustedAssumptions.push(`Manual adjustments applied: ${adjustedSectionNames.join(', ')}`);
      }
      const markupNotes: string[] = [];
      if (editableValues.overheadPercent !== 10) markupNotes.push(`Overhead: ${editableValues.overheadPercent}%`);
      if (editableValues.profitPercent !== 10) markupNotes.push(`Profit: ${editableValues.profitPercent}%`);
      if (editableValues.contingencyPercent !== 5) markupNotes.push(`Contingency: ${editableValues.contingencyPercent}%`);
      if (markupNotes.length > 0) {
        adjustedAssumptions.push(`Markup percentages adjusted — ${markupNotes.join(', ')}`);
      }
    }

    // Use custom risks if user has edited, otherwise use original
    const adjustedRisks = editableValues.customRisks !== null
      ? [...editableValues.customRisks]
      : [...budget.risks];

    const adjusted: GeneratedBudget = {
      ...budget,
      sections: adjustedSections,
      assumptions: adjustedAssumptions,
      risks: adjustedRisks,
      totals: {
        laborSubtotal,
        materialSubtotal,
        equipmentSubtotal,
        subcontractSubtotal,
        directCostSubtotal,
        overhead,
        profit,
        contingency,
        grandTotal
      },
      summary: {
        ...budget.summary,
        estimatedTotalCost: grandTotal,
        costPerSquareFoot: grandTotal / budget.summary.squareFootage
      }
    };

    setAdjustedBudget(adjusted);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!projectName || !sqft || (!buildingType && !projectType)) {
      setError('Please fill in project name, square footage, and at least one of building type or project type.');
      return;
    }

    try {
      setLoading(true);
      setBudget(null);
      setAdjustedBudget(null);
      setIsEditMode(false);

      const result = await budgetGeneratorService.generate({
        projectName,
        buildingType: buildingType || undefined,
        projectType: projectType || undefined,
        bidType: bidType || undefined,
        sqft: parseFloat(sqft),
        scope: scope || undefined,
        location: location || undefined,
        selectedProjectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined
      });

      setBudget(result.budget);
      setComparableProjects(result.similarProjects);

      // Initialize editable values from generated budget - derive actual percentages from AI output
      const dc = result.budget.totals.directCostSubtotal;
      setEditableValues({
        overheadPercent: dc > 0 ? Math.round((result.budget.totals.overhead / dc) * 100) : 10,
        profitPercent: dc > 0 ? Math.round((result.budget.totals.profit / dc) * 100) : 10,
        contingencyPercent: dc > 0 ? Math.round((result.budget.totals.contingency / dc) * 100) : 5,
        sectionAdjustments: {},
        excludedSections: {},
        customAssumptions: null,
        customRisks: null
      });

      // Auto-expand summary section
      setExpandedSections({ 'summary': true });

    } catch (err: any) {
      console.error('Error generating budget:', err);
      setError(err.response?.data?.error || 'Failed to generate budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0';
    return '$' + Math.round(value).toLocaleString();
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0';
    return Math.round(value).toLocaleString();
  };

  const getConfidenceBadge = (level: string) => {
    const colors: { [key: string]: string } = {
      high: '#16a34a',
      medium: '#ca8a04',
      low: '#dc2626'
    };
    return (
      <span
        className="confidence-badge"
        style={{ backgroundColor: colors[level] || colors.medium }}
      >
        {level.toUpperCase()} CONFIDENCE
      </span>
    );
  };

  const getConfidenceDetails = (level: string) => {
    const details: { [key: string]: { icon: string; text: string; subtext: string } } = {
      high: {
        icon: '✓',
        text: 'High Confidence',
        subtext: 'Based on 5+ similar projects within ±20% square footage'
      },
      medium: {
        icon: '~',
        text: 'Medium Confidence',
        subtext: 'Based on 2-4 similar projects or broader criteria match'
      },
      low: {
        icon: '!',
        text: 'Low Confidence',
        subtext: 'Limited historical data available for this project type'
      }
    };
    return details[level] || details.medium;
  };

  const handleReset = () => {
    setProjectName('');
    setBuildingType('');
    setProjectType('');
    setBidType('');
    setLocation('');
    setSqft('');
    setScope('');
    setBudget(null);
    setAdjustedBudget(null);
    setComparableProjects([]);
    setShowPreview(false);
    setPreviewProjects([]);
    setPreviewAverages(null);
    setError('');
    setSuccessMessage('');
    setIsEditMode(false);
    setEditableValues({
      overheadPercent: 10,
      profitPercent: 10,
      contingencyPercent: 5,
      sectionAdjustments: {},
      excludedSections: {},
      customAssumptions: null,
      customRisks: null
    });
  };

  const handleSaveBudget = async (status: 'draft' | 'final' = 'draft') => {
    const currentBudget = isEditMode && adjustedBudget ? adjustedBudget : budget;
    if (!currentBudget) return;

    try {
      setSaving(true);
      setError('');

      const budgetData: Partial<Budget> = {
        project_name: currentBudget.summary.projectName,
        building_type: currentBudget.summary.buildingType,
        project_type: currentBudget.summary.projectType,
        bid_type: bidType || undefined,
        location: location || undefined,
        square_footage: currentBudget.summary.squareFootage,
        scope_notes: scope || undefined,
        estimated_total: currentBudget.summary.estimatedTotalCost,
        cost_per_sqft: currentBudget.summary.costPerSquareFoot,
        confidence_level: currentBudget.summary.confidenceLevel as 'high' | 'medium' | 'low',
        methodology: currentBudget.summary.methodology,
        labor_subtotal: currentBudget.totals.laborSubtotal,
        material_subtotal: currentBudget.totals.materialSubtotal,
        equipment_subtotal: currentBudget.totals.equipmentSubtotal,
        subcontract_subtotal: currentBudget.totals.subcontractSubtotal,
        direct_cost_subtotal: currentBudget.totals.directCostSubtotal,
        overhead: currentBudget.totals.overhead,
        profit: currentBudget.totals.profit,
        contingency: currentBudget.totals.contingency,
        grand_total: currentBudget.totals.grandTotal,
        overhead_percent: editableValues.overheadPercent,
        profit_percent: editableValues.profitPercent,
        contingency_percent: editableValues.contingencyPercent,
        sections: currentBudget.sections,
        assumptions: currentBudget.assumptions,
        risks: currentBudget.risks,
        comparable_projects: comparableProjects.map(p => ({
          name: p.name,
          building_type: buildingType,
          square_footage: p.sqft,
          total_cost: p.totalCost,
          cost_per_sqft: p.costPerSqft,
          year: new Date().getFullYear(),
          similarity_score: p.similarityScore
        })),
        status
      };

      if (isEditing && id) {
        await budgetsApi.update(parseInt(id, 10), budgetData);
        setSuccessMessage(`Budget ${status === 'final' ? 'finalized' : 'updated'} successfully!`);
      } else {
        await budgetsApi.create(budgetData);
        setSuccessMessage(`Budget ${status === 'final' ? 'finalized' : 'saved as draft'} successfully!`);
      }

      // Navigate to budgets list after short delay
      setTimeout(() => {
        navigate('/estimating/budgets');
      }, 1500);

    } catch (err: any) {
      console.error('Error saving budget:', err);
      setError(err.response?.data?.error || 'Failed to save budget. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportReport = () => {
    // Open the professional report modal
    setShowReportModal(true);
  };

  const handleEditModeToggle = () => {
    if (!isEditMode && budget) {
      // Entering edit mode - set adjusted budget to current budget
      setAdjustedBudget({ ...budget });
      // Derive actual percentages from budget so edits don't shift the total
      const dc = budget.totals.directCostSubtotal;
      if (dc > 0) {
        setEditableValues(prev => ({
          ...prev,
          overheadPercent: Math.round((budget.totals.overhead / dc) * 100),
          profitPercent: Math.round((budget.totals.profit / dc) * 100),
          contingencyPercent: Math.round((budget.totals.contingency / dc) * 100),
        }));
      }
    }
    setIsEditMode(!isEditMode);
  };

  const handlePercentChange = (field: 'overheadPercent' | 'profitPercent' | 'contingencyPercent', value: number) => {
    setHasUserEdited(true);
    setEditableValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSectionAdjustment = (sectionName: string, value: number) => {
    setHasUserEdited(true);
    setEditableValues(prev => ({
      ...prev,
      sectionAdjustments: {
        ...prev.sectionAdjustments,
        [sectionName]: value
      }
    }));
  };

  const handleToggleExclude = (sectionName: string) => {
    setHasUserEdited(true);
    setEditableValues(prev => ({
      ...prev,
      excludedSections: {
        ...prev.excludedSections,
        [sectionName]: !prev.excludedSections[sectionName]
      }
    }));
  };

  const handleAdjustmentInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sectionName: string) => {
    if (e.key === 'Enter') {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(value)) {
        handleSectionAdjustment(sectionName, value);
      }
      setEditingAdjustment(null);
    } else if (e.key === 'Escape') {
      setEditingAdjustment(null);
    }
  };

  const handleAdjustmentInputBlur = (e: React.FocusEvent<HTMLInputElement>, sectionName: string) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      handleSectionAdjustment(sectionName, value);
    }
    setEditingAdjustment(null);
  };

  const handleToggleProjectSelection = (projectId: number) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  // Get current budget (adjusted if in edit mode)
  const currentBudget = isEditMode && adjustedBudget ? adjustedBudget : budget;

  // Chart data for cost breakdown
  const getCostBreakdownChartData = () => {
    if (!currentBudget) return null;

    return {
      labels: ['Labor', 'Material', 'Equipment', 'Subcontract', 'Overhead', 'Profit', 'Contingency'],
      datasets: [{
        data: [
          currentBudget.totals.laborSubtotal,
          currentBudget.totals.materialSubtotal,
          currentBudget.totals.equipmentSubtotal,
          currentBudget.totals.subcontractSubtotal,
          currentBudget.totals.overhead,
          currentBudget.totals.profit,
          currentBudget.totals.contingency
        ],
        backgroundColor: [
          '#002356',
          '#0066cc',
          '#00a3e0',
          '#7dd3fc',
          '#f59e0b',
          '#22c55e',
          '#ef4444'
        ],
        borderWidth: 0
      }]
    };
  };

  // Chart data for section breakdown
  const getSectionChartData = () => {
    if (!currentBudget) return null;

    return {
      labels: currentBudget.sections.map(s => s.name),
      datasets: [{
        label: 'Section Cost',
        data: currentBudget.sections.map(s => s.subtotal),
        backgroundColor: '#002356',
        borderRadius: 4
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 12,
          font: { size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            return ` ${formatCurrency(value)}`;
          }
        }
      }
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatCurrency(context.raw)
        }
      }
    },
    scales: {
      x: {
        ticks: {
          callback: (value: any) => formatCurrency(value)
        }
      }
    }
  };

  return (
    <>
    <div className="budget-generator" ref={reportRef}>
      {loadingExisting && (
        <div className="card loading-card">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading budget...</p>
          </div>
        </div>
      )}

      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/estimating/budgets" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Budgets
            </Link>
            <h1>💵 Budget Generator</h1>
            <div className="sales-subtitle">Generate a new project budget</div>
          </div>
        </div>
        <div className="sales-header-actions">
          {currentBudget && (
            <div className="no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className={`btn ${isEditMode ? 'btn-warning' : 'btn-secondary'}`}
                onClick={handleEditModeToggle}
              >
                {isEditMode ? 'Exit Edit Mode' : 'Edit Budget'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleExportReport}
              >
                Export Report
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleSaveBudget('draft')}
                disabled={saving}
              >
                {saving ? 'Saving...' : (isEditing ? 'Update Draft' : 'Save Draft')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSaveBudget('final')}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Finalize Budget'}
              </button>
            </div>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="success-message no-print">
          {successMessage}
        </div>
      )}

      <div className="budget-generator-layout">
        {/* Left Column - Input Form */}
        <div className="budget-form-column no-print">
          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Project Details</h2>

            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Building Type</label>
                <select
                  className="form-input"
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                >
                  <option value="">Any building type</option>
                  {options.buildingTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Project Type</label>
                <select
                  className="form-input"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                >
                  <option value="">Any project type</option>
                  {options.projectTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bid Type</label>
                <select
                  className="form-input"
                  value={bidType}
                  onChange={(e) => setBidType(e.target.value)}
                >
                  <option value="">Any bid type</option>
                  {options.bidTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Green Bay, WI"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Square Footage *</label>
                <input
                  type="number"
                  className="form-input"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="Enter square footage"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional Scope Notes</label>
                <textarea
                  className="form-input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Optional: Describe any special requirements or scope details..."
                  rows={3}
                />
              </div>

              {error && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !projectName || (!buildingType && !projectType) || !sqft}
                >
                  {loading ? 'Generating...' : 'Generate Budget'}
                </button>
                {budget && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                  >
                    Start Over
                  </button>
                )}
              </div>
            </form>
          </div>


          {/* Edit Mode Panel */}
          {isEditMode && currentBudget && (
            <div className="card edit-mode-panel">
              <h3 style={{ marginTop: 0 }}>Adjust Budget</h3>

              <div className="edit-section">
                <h4>Markup Percentages</h4>

                <div className="slider-group">
                  <label>
                    Overhead: {editableValues.overheadPercent}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="0.5"
                    value={editableValues.overheadPercent}
                    onChange={(e) => handlePercentChange('overheadPercent', parseFloat(e.target.value))}
                  />
                  <span className="slider-value">{formatCurrency(currentBudget.totals.overhead)}</span>
                </div>

                <div className="slider-group">
                  <label>
                    Profit: {editableValues.profitPercent}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="0.5"
                    value={editableValues.profitPercent}
                    onChange={(e) => handlePercentChange('profitPercent', parseFloat(e.target.value))}
                  />
                  <span className="slider-value">{formatCurrency(currentBudget.totals.profit)}</span>
                </div>

                <div className="slider-group">
                  <label>
                    Contingency: {editableValues.contingencyPercent}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={editableValues.contingencyPercent}
                    onChange={(e) => handlePercentChange('contingencyPercent', parseFloat(e.target.value))}
                  />
                  <span className="slider-value">{formatCurrency(currentBudget.totals.contingency)}</span>
                </div>
              </div>

              <div className="edit-section">
                <h4>Section Adjustments</h4>
                {currentBudget.sections.map(section => {
                  const adjustment = editableValues.sectionAdjustments[section.name] || 0;
                  const isExcluded = editableValues.excludedSections[section.name];
                  return (
                    <div key={section.name} className={`slider-group ${isExcluded ? 'section-excluded' : ''}`}>
                      <div className="slider-group-header">
                        <button
                          type="button"
                          className={`section-exclude-toggle ${isExcluded ? 'excluded' : ''}`}
                          onClick={() => handleToggleExclude(section.name)}
                          title={isExcluded ? 'Include section' : 'Exclude section'}
                        >
                          {isExcluded ? '○' : '●'}
                        </button>
                        <label className={isExcluded ? 'excluded-label' : ''}>
                          {section.name}:
                          {editingAdjustment === `panel-${section.name}` ? (
                            <input
                              type="number"
                              className="adjustment-input"
                              defaultValue={adjustment}
                              autoFocus
                              onKeyDown={(e) => handleAdjustmentInputKeyDown(e, section.name)}
                              onBlur={(e) => handleAdjustmentInputBlur(e, section.name)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="adjustment-label-clickable"
                              onClick={() => !isExcluded && setEditingAdjustment(`panel-${section.name}`)}
                            >
                              {' '}{adjustment >= 0 ? '+' : ''}{adjustment}%
                            </span>
                          )}
                        </label>
                      </div>
                      {!isExcluded && (
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={Math.max(-100, Math.min(100, adjustment))}
                          onChange={(e) => handleSectionAdjustment(section.name, parseFloat(e.target.value))}
                        />
                      )}
                      <span className="slider-value">
                        {isExcluded ? 'Excluded' : formatCurrency(section.subtotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="budget-results-column">
          {loading && (
            <div className="card loading-card">
              <div className="titan-loading-container">
                <div className="titan-logo-spinner">
                  <div className="spinner-ring"></div>
                  <div className="spinner-ring"></div>
                  <div className="spinner-ring"></div>
                  <span className="titan-icon">T</span>
                </div>
                <h3>Titan is Working...</h3>
                <div className="titan-messages">
                  <p className="titan-message">Analyzing historical project data...</p>
                  <p className="titan-message">Comparing similar building types...</p>
                  <p className="titan-message">Calculating cost projections...</p>
                  <p className="titan-message">Applying regional labor rates...</p>
                  <p className="titan-message">Reviewing material costs...</p>
                  <p className="titan-message">Finalizing your estimate...</p>
                </div>
                <div className="titan-progress-bar">
                  <div className="titan-progress-fill"></div>
                </div>
              </div>
            </div>
          )}

          {currentBudget && (
            <>
              {/* Summary Card */}
              <div className="card summary-card">
                <div className="summary-header">
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0 }}>{currentBudget.summary.projectName}</h2>
                    <p>
                      {currentBudget.summary.buildingType} - {currentBudget.summary.projectType}
                    </p>
                  </div>
                  {getConfidenceBadge(currentBudget.summary.confidenceLevel)}
                </div>

                <div className="summary-totals">
                  <div className="total-item confidence-details-item">
                    {(() => {
                      const details = getConfidenceDetails(currentBudget.summary.confidenceLevel);
                      return (
                        <div className="confidence-details">
                          <span className="confidence-icon">{details.icon}</span>
                          <div className="confidence-text">
                            <strong>{details.text}</strong>
                            <span>{details.subtext}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="total-item main-total">
                    <span className="total-label">Estimated Total</span>
                    <span className="total-value">{formatCurrency(currentBudget.summary.estimatedTotalCost)}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Cost per SF</span>
                    <span className="total-value">${(currentBudget.summary.costPerSquareFoot || 0).toFixed(2)}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Square Footage</span>
                    <span className="total-value">{formatNumber(currentBudget.summary.squareFootage)} SF</span>
                  </div>
                </div>

                <div className="methodology">
                  <strong>Methodology:</strong> {currentBudget.summary.methodology}
                </div>
              </div>

              {/* Charts Section */}
              <div className="card charts-card">
                <h3 style={{ marginTop: 0 }}>Cost Analysis</h3>
                <div className="charts-grid">
                  <div className="chart-container">
                    <h4>Cost Breakdown</h4>
                    <div className="chart-wrapper">
                      {getCostBreakdownChartData() && (
                        <Doughnut data={getCostBreakdownChartData()!} options={chartOptions} />
                      )}
                    </div>
                  </div>
                  <div className="chart-container">
                    <h4>By Section</h4>
                    <div className="chart-wrapper bar-chart">
                      {getSectionChartData() && (
                        <Bar data={getSectionChartData()!} options={barChartOptions} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparable Projects */}
              {comparableProjects.length > 0 && (
                <div className="card comparable-projects-card">
                  <h3 style={{ marginTop: 0 }}>Top {Math.min(3, comparableProjects.length)} Comparable Projects</h3>
                  <div className="comparable-projects-grid">
                    {comparableProjects.slice(0, 3).map((project, index) => (
                      <div key={project.id || index} className="comparable-project">
                        <div className="comparable-header">
                          <span className="comparable-rank">#{index + 1}</span>
                          <span className="comparable-name">{project.name}</span>
                          {project.bidYear && (
                            <span className="comparable-year" style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
                              ({project.bidYear})
                            </span>
                          )}
                        </div>
                        <div className="comparable-details">
                          <div className="detail-row">
                            <span>Size:</span>
                            <span>{formatNumber(project.sqft)} SF</span>
                          </div>
                          <div className="detail-row">
                            <span>Total Cost (Today's $):</span>
                            <span>{formatCurrency(project.totalCost)}</span>
                          </div>
                          {project.originalTotalCost && project.originalTotalCost !== project.totalCost && (
                            <div className="detail-row" style={{ fontSize: '12px', color: '#666' }}>
                              <span>Original ({project.bidYear}):</span>
                              <span>{formatCurrency(project.originalTotalCost)}</span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span>Cost/SF:</span>
                            <span>${(project.costPerSqft || 0).toFixed(2)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Match Score:</span>
                            <span className="match-score">{project.similarityScore}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Breakdown Sections */}
              <div className="card sections-card">
                <h3 style={{ marginTop: 0 }}>Cost Breakdown</h3>

                {currentBudget.sections.map((section, index) => {
                  const adjustment = editableValues.sectionAdjustments[section.name] || 0;
                  const isExcluded = editableValues.excludedSections[section.name];
                  return (
                  <div key={index} className={`budget-section ${isExcluded ? 'section-excluded' : ''}`}>
                    <div
                      className="section-header-row"
                      onClick={() => toggleSection(section.name)}
                    >
                      {isEditMode && (
                        <button
                          type="button"
                          className={`section-exclude-toggle-inline ${isExcluded ? 'excluded' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleToggleExclude(section.name); }}
                          title={isExcluded ? 'Include section' : 'Exclude section'}
                        >
                          {isExcluded ? '○' : '●'}
                        </button>
                      )}
                      <span className="section-expand-icon">
                        {expandedSections[section.name] ? '▼' : '▶'}
                      </span>
                      <span className={`section-name ${isExcluded ? 'excluded-label' : ''}`}>{section.name}</span>
                      {isEditMode && !isExcluded && (
                        <div className="section-inline-slider" onClick={(e) => e.stopPropagation()}>
                          {editingAdjustment === `inline-${section.name}` ? (
                            <input
                              type="number"
                              className="adjustment-input inline"
                              defaultValue={adjustment}
                              autoFocus
                              onKeyDown={(e) => handleAdjustmentInputKeyDown(e, section.name)}
                              onBlur={(e) => handleAdjustmentInputBlur(e, section.name)}
                            />
                          ) : (
                            <span
                              className="inline-adjustment-label adjustment-label-clickable"
                              onClick={() => setEditingAdjustment(`inline-${section.name}`)}
                            >
                              {adjustment >= 0 ? '+' : ''}{adjustment}%
                            </span>
                          )}
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            step="1"
                            value={Math.max(-100, Math.min(100, adjustment))}
                            onChange={(e) => handleSectionAdjustment(section.name, parseFloat(e.target.value))}
                          />
                        </div>
                      )}
                      <span className="section-subtotal">
                        {isExcluded ? <span className="excluded-amount">Excluded</span> : formatCurrency(section.subtotal)}
                      </span>
                    </div>

                    {expandedSections[section.name] && section.items.length > 0 && (
                      <div className="section-items">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Qty</th>
                              <th>Labor</th>
                              <th>Material</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((item, itemIndex) => (
                              <tr key={itemIndex}>
                                <td>{item.description}</td>
                                <td>{item.quantity ? `${formatNumber(item.quantity)} ${item.unit || ''}` : '-'}</td>
                                <td>{formatCurrency(item.laborCost)}</td>
                                <td>{formatCurrency(item.materialCost)}</td>
                                <td><strong>{formatCurrency(item.totalCost)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );})}

                {/* Totals Summary */}
                <div className="totals-summary">
                  <div className="totals-row">
                    <span>Labor Subtotal</span>
                    <span>{formatCurrency(currentBudget.totals.laborSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Material Subtotal</span>
                    <span>{formatCurrency(currentBudget.totals.materialSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Equipment Subtotal</span>
                    <span>{formatCurrency(currentBudget.totals.equipmentSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Subcontract Subtotal</span>
                    <span>{formatCurrency(currentBudget.totals.subcontractSubtotal)}</span>
                  </div>
                  <div className="totals-row subtotal">
                    <span>Direct Cost Subtotal</span>
                    <span>{formatCurrency(currentBudget.totals.directCostSubtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Overhead ({editableValues.overheadPercent}%)</span>
                    <span>{formatCurrency(currentBudget.totals.overhead)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Profit ({editableValues.profitPercent}%)</span>
                    <span>{formatCurrency(currentBudget.totals.profit)}</span>
                  </div>
                  <div className="totals-row">
                    <span>Contingency ({editableValues.contingencyPercent}%)</span>
                    <span>{formatCurrency(currentBudget.totals.contingency)}</span>
                  </div>
                  <div className="totals-row grand-total">
                    <span>GRAND TOTAL</span>
                    <span>{formatCurrency(currentBudget.totals.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Assumptions & Risks */}
              <div className="card assumptions-risks-card">
                <div className="assumptions-risks-grid">
                  <div className="assumptions-section">
                    <h4>Key Assumptions</h4>
                    <ul>
                      {currentBudget.assumptions.map((assumption, index) => (
                        <li key={index}>
                          {isEditMode ? (
                            <div className="editable-list-item">
                              <input
                                type="text"
                                className="editable-list-input"
                                value={assumption}
                                onChange={(e) => {
                                  const current = editableValues.customAssumptions ?? [...currentBudget.assumptions];
                                  const updated = [...current];
                                  updated[index] = e.target.value;
                                  setHasUserEdited(true);
                                  setEditableValues(prev => ({ ...prev, customAssumptions: updated }));
                                }}
                              />
                              <button
                                type="button"
                                className="editable-list-remove"
                                title="Remove"
                                onClick={() => {
                                  const current = editableValues.customAssumptions ?? [...currentBudget.assumptions];
                                  const updated = current.filter((_, i) => i !== index);
                                  setHasUserEdited(true);
                                  setEditableValues(prev => ({ ...prev, customAssumptions: updated }));
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : assumption}
                        </li>
                      ))}
                    </ul>
                    {isEditMode && (
                      <button
                        type="button"
                        className="editable-list-add"
                        onClick={() => {
                          const current = editableValues.customAssumptions ?? [...currentBudget.assumptions];
                          setHasUserEdited(true);
                          setEditableValues(prev => ({ ...prev, customAssumptions: [...current, ''] }));
                        }}
                      >
                        + Add Assumption
                      </button>
                    )}
                  </div>
                  <div className="risks-section">
                    <h4>Potential Risks</h4>
                    <ul>
                      {currentBudget.risks.map((risk, index) => (
                        <li key={index}>
                          {isEditMode ? (
                            <div className="editable-list-item">
                              <input
                                type="text"
                                className="editable-list-input"
                                value={risk}
                                onChange={(e) => {
                                  const current = editableValues.customRisks ?? [...currentBudget.risks];
                                  const updated = [...current];
                                  updated[index] = e.target.value;
                                  setHasUserEdited(true);
                                  setEditableValues(prev => ({ ...prev, customRisks: updated }));
                                }}
                              />
                              <button
                                type="button"
                                className="editable-list-remove"
                                title="Remove"
                                onClick={() => {
                                  const current = editableValues.customRisks ?? [...currentBudget.risks];
                                  const updated = current.filter((_, i) => i !== index);
                                  setHasUserEdited(true);
                                  setEditableValues(prev => ({ ...prev, customRisks: updated }));
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : risk}
                        </li>
                      ))}
                    </ul>
                    {isEditMode && (
                      <button
                        type="button"
                        className="editable-list-add"
                        onClick={() => {
                          const current = editableValues.customRisks ?? [...currentBudget.risks];
                          setHasUserEdited(true);
                          setEditableValues(prev => ({ ...prev, customRisks: [...current, ''] }));
                        }}
                      >
                        + Add Risk
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Print Footer */}
              <div className="print-footer print-only">
                <p>Generated by Titan Budget Generator on {new Date().toLocaleDateString()}</p>
                <p>Tweet Garot Mechanical - Confidential</p>
              </div>
            </>
          )}

          {!loading && !budget && (
            <>
              {/* Similar Projects Preview - Shows when building/project type selected */}
              {showPreview ? (
                <div className="card similar-projects-preview-card">
                  <div className="preview-header">
                    <h3 style={{ margin: 0 }}>
                      Similar Projects Preview
                      {previewLoading && <span className="loading-indicator"> Loading...</span>}
                    </h3>
                    {previewAverages && previewAverages.project_count > 0 && (
                      <span className="projects-count">{previewAverages.project_count} projects found</span>
                    )}
                  </div>

                  {previewAverages && (
                    <>
                      <div className="preview-stats-bar">
                        <div className="stat-item">
                          <span className="stat-label">Avg Cost</span>
                          <span className="stat-value">{formatCurrency(previewAverages.avg_total_cost)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Cost/SF</span>
                          <span className="stat-value">${(parseFloat(previewAverages.avg_cost_per_sqft) || 0).toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Size</span>
                          <span className="stat-value">{formatNumber(previewAverages.avg_sqft)} SF</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                        * All costs adjusted for inflation to {new Date().getFullYear()} dollars (4% annual rate)
                      </div>
                    </>
                  )}

                  {selectedProjectIds.length > 0 && (
                    <div className="selected-projects-count">
                      {selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''} selected for generation
                    </div>
                  )}

                  {previewProjects.length > 0 ? (
                    <div className="preview-projects-grid">
                      {previewProjects.slice(0, 12).map((project, index) => {
                        const isSelected = project.id && selectedProjectIds.includes(project.id);
                        return (
                        <div
                          key={project.id || index}
                          className={`preview-project-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => project.id && handleToggleProjectSelection(project.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="preview-project-header">
                            <input
                              type="checkbox"
                              className="project-select-checkbox"
                              checked={isSelected}
                              onChange={() => project.id && handleToggleProjectSelection(project.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="project-rank">#{index + 1}</span>
                            <span className="match-badge">{project.similarity_score}% match</span>
                          </div>
                          <div className="preview-project-name" title={project.name}>{project.name}</div>

                          {/* Match Criteria Indicators */}
                          <div className="match-criteria">
                            <span className={`criteria-tag ${project.match_details?.building_type ? 'match' : 'no-match'}`}>
                              {project.match_details?.building_type ? '✓' : '✗'} Building
                            </span>
                            <span className={`criteria-tag ${project.match_details?.project_type ? 'match' : 'no-match'}`}>
                              {project.match_details?.project_type ? '✓' : '✗'} Project
                            </span>
                            <span className={`criteria-tag ${project.match_details?.bid_type ? 'match' : 'no-match'}`}>
                              {project.match_details?.bid_type ? '✓' : '✗'} Bid
                            </span>
                            <span className={`criteria-tag ${project.match_details?.sqft_within_25 ? 'match' : project.match_details?.sqft_within_50 ? 'partial' : 'no-match'}`}>
                              {project.match_details?.sqft_diff_percent !== null
                                ? `${project.match_details.sqft_diff_percent > 0 ? '+' : ''}${project.match_details.sqft_diff_percent}% SF`
                                : '— SF'}
                            </span>
                          </div>

                          {/* Row 1: Original/Historical Data */}
                          <div className="preview-project-details" style={{ borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '6px' }}>
                            <div className="detail-item">
                              <span className="detail-label">Bid Year</span>
                              <span className="detail-value">{project.bid_date ? new Date(project.bid_date).getFullYear() : 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Original Cost</span>
                              <span className="detail-value">{formatCurrency(project.original_total_cost)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Orig Cost/SF</span>
                              <span className="detail-value">${(project.original_total_cost && project.total_sqft ? (project.original_total_cost / project.total_sqft) : 0).toFixed(2)}</span>
                            </div>
                          </div>
                          {/* Row 2: Current/Adjusted Data */}
                          <div className="preview-project-details">
                            <div className="detail-item">
                              <span className="detail-label">Size</span>
                              <span className="detail-value" style={{ fontWeight: 600 }}>{formatNumber(project.total_sqft)} SF</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Today's Cost</span>
                              <span className="detail-value" style={{ fontWeight: 600 }}>{formatCurrency(project.total_cost)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Today's $/SF</span>
                              <span className="detail-value" style={{ fontWeight: 600 }}>${(parseFloat(project.total_cost_per_sqft) || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : !previewLoading && (
                    <div className="no-projects-message">
                      <p>No similar projects found for the selected criteria.</p>
                      <p>The estimate will be based on general averages.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card empty-state-card">
                  <div className="empty-state-icon">🔧</div>
                  <h3>Ready to Generate</h3>
                  <p>Fill in the project details and click "Generate Budget" to create an AI-powered estimate based on historical project data.</p>
                  <div className="empty-state-hint">
                    <p>Select a <strong>Building Type</strong> and <strong>Project Type</strong> to preview similar projects.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* Budget Report Modal */}
    {currentBudget && (
      <BudgetReportModal
        budget={currentBudget}
        comparableProjects={comparableProjects}
        editableValues={editableValues}
        bidType={bidType}
        scope={scope}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    )}
    </>
  );
};

export default BudgetGenerator;
