import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { Opportunity, PipelineStage } from '../../services/opportunities';
import OpportunityCard from './OpportunityCard';
import OpportunityModal from './OpportunityModal';
import '../../styles/OpportunityKanban.css';

const OpportunityKanban: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Opportunity | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // Fetch Kanban data
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['opportunities', 'kanban'],
    queryFn: () => opportunitiesService.getKanbanView()
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) =>
      opportunitiesService.updateStage(id, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  });

  // Calculate total pipeline value
  const totalPipelineValue = stages.reduce((total, stage) => {
    return total + stage.opportunities.reduce((stageTotal, opp) => {
      return stageTotal + (opp.estimated_value || 0);
    }, 0);
  }, 0);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, opportunity: Opportunity) => {
    setDraggedItem(opportunity);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStageId: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.stage_id !== targetStageId) {
      updateStageMutation.mutate({
        id: draggedItem.id,
        stageId: targetStageId
      });
    }
    setDraggedItem(null);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent, opportunity: Opportunity) => {
    setDraggedItem(opportunity);
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !draggedItem) return;

    const deltaX = e.touches[0].clientX - touchStart.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStart.y);

    // Horizontal swipe detected
    if (Math.abs(deltaX) > 50 && deltaY < 30) {
      const currentStage = stages.find(s => s.stage_id === draggedItem.stage_id);
      if (!currentStage) return;

      const currentIndex = stages.indexOf(currentStage);
      let newIndex = currentIndex;

      if (deltaX > 0 && currentIndex < stages.length - 1) {
        newIndex = currentIndex + 1; // Swipe right
      } else if (deltaX < 0 && currentIndex > 0) {
        newIndex = currentIndex - 1; // Swipe left
      }

      if (newIndex !== currentIndex) {
        updateStageMutation.mutate({
          id: draggedItem.id,
          stageId: stages[newIndex].stage_id
        });
        setDraggedItem(null);
        setTouchStart(null);
      }
    }
  };

  const handleTouchEnd = () => {
    setDraggedItem(null);
    setTouchStart(null);
  };

  const handleCardClick = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedOpportunity(null);
    setIsModalOpen(true);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="kanban-loading">
        <div className="loading-spinner"></div>
        <p>Loading pipeline...</p>
      </div>
    );
  }

  return (
    <div className="opportunity-kanban">
      {/* Header with stats */}
      <div className="kanban-header">
        <div className="kanban-stats">
          <div className="stat-card">
            <span className="stat-label">Total Pipeline</span>
            <span className="stat-value">{formatCurrency(totalPipelineValue)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Opportunities</span>
            <span className="stat-value">
              {stages.reduce((total, stage) => total + stage.opportunities.length, 0)}
            </span>
          </div>
        </div>
        <button className="btn-create-opportunity" onClick={handleCreateNew}>
          <span className="btn-icon">+</span>
          <span className="btn-text">New Lead</span>
        </button>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board" ref={scrollContainerRef}>
        {stages.map(stage => (
          <div
            key={stage.stage_id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.stage_id)}
          >
            {/* Column Header */}
            <div className="column-header" style={{ borderTopColor: stage.stage_color }}>
              <div className="column-title">
                <span className="stage-name">{stage.stage_name}</span>
                <span className="stage-count">{stage.opportunities.length}</span>
              </div>
              <div className="column-value">
                {formatCurrency(
                  stage.opportunities.reduce((sum, opp) => sum + (opp.estimated_value || 0), 0)
                )}
              </div>
            </div>

            {/* Cards */}
            <div className="column-cards">
              {stage.opportunities.length === 0 ? (
                <div className="empty-column">
                  <p>Drop opportunities here</p>
                </div>
              ) : (
                stage.opportunities.map(opportunity => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onDragStart={handleDragStart}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={handleCardClick}
                    isDragging={draggedItem?.id === opportunity.id}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Opportunity Detail/Edit Modal */}
      {isModalOpen && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={() => setIsModalOpen(false)}
          onSave={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
          }}
        />
      )}
    </div>
  );
};

export default OpportunityKanban;
