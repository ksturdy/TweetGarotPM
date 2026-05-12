import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PhaseScheduleItem } from '../../services/phaseSchedule';
import { phaseScheduleLinksApi } from '../../services/phaseScheduleLinks';
import PhaseGCLinkModal from './PhaseGCLinkModal';

interface Props {
  item: PhaseScheduleItem;
  projectId: number;
  compact?: boolean;
  /** When 'badge', render a single button showing the link count instead of inline chips. */
  variant?: 'chips' | 'badge';
}

const PhaseGCLinkChips: React.FC<Props> = ({ item, projectId, compact = false, variant = 'chips' }) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const links = item.linked_gc_activities || [];

  const removeMutation = useMutation({
    mutationFn: (activityId: string) => phaseScheduleLinksApi.removeOne(item.id, activityId),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['phaseScheduleItems'] });
    },
  });

  const unlinkAllMutation = useMutation({
    mutationFn: () => phaseScheduleLinksApi.replaceForItem(item.id, []),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['phaseScheduleItems'] });
    },
  });

  const fontSize = compact ? 10 : 11;
  const linkedCount = links.length;
  const hasMissing = links.some((l) => l.missing);

  if (variant === 'badge') {
    const title = linkedCount === 0
      ? 'Link this phase to GC schedule activities'
      : links.map((l) => `${l.activity_id}${l.missing ? ' (missing)' : ''}`).join('\n');
    const fg = linkedCount === 0 ? '#94a3b8' : hasMissing ? '#92400e' : '#075985';
    return (
      <>
        <span
          onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
          title={title}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: linkedCount === 0 ? 'transparent' : hasMissing ? '#fef3c7' : '#e0f2fe',
            border: linkedCount === 0 ? '1px dashed #cbd5e1' : `1px solid ${hasMissing ? '#fde68a' : '#bae6fd'}`,
            borderRadius: 10,
            color: fg,
            fontSize, padding: '1px 6px', cursor: 'pointer', lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          <span>
            🔗 {linkedCount === 0
              ? 'Link'
              : linkedCount === 1
                ? links[0].activity_id
                : `${links[0].activity_id} +${linkedCount - 1}`}
          </span>
          {linkedCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); unlinkAllMutation.mutate(); }}
              disabled={unlinkAllMutation.isPending}
              title={linkedCount === 1 ? 'Remove link' : `Remove all ${linkedCount} links`}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: fg, fontSize: fontSize + 1, padding: 0, lineHeight: 1,
              }}
              aria-label="Remove link"
            >✕</button>
          )}
        </span>
        {modalOpen && (
          <PhaseGCLinkModal
            phaseItem={item}
            projectId={projectId}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', verticalAlign: 'middle' }}
            onClick={(e) => e.stopPropagation()}>
        {links.length === 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
            title="Link this phase to one or more GC schedule activities"
            style={{
              background: 'transparent', border: '1px dashed #cbd5e1', borderRadius: 10,
              color: '#94a3b8', fontSize, padding: '1px 6px', cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            🔗 Link
          </button>
        )}
        {links.map((l) => {
          const missing = l.missing;
          const bg = missing ? '#fef3c7' : '#e0f2fe';
          const border = missing ? '#fde68a' : '#bae6fd';
          const fg = missing ? '#92400e' : '#075985';
          const tip = missing
            ? `Activity "${l.activity_id}" is not in the active GC version. Click ✕ to remove.`
            : `${l.activity_name || ''} • ${l.start_date || '—'} → ${l.finish_date || '—'}`;
          return (
            <span key={l.activity_id}
              title={tip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: bg, border: `1px solid ${border}`, color: fg,
                borderRadius: 10, padding: '1px 6px', fontSize, lineHeight: 1.2,
                fontFamily: 'monospace',
              }}>
              {l.activity_id}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeMutation.mutate(l.activity_id); }}
                disabled={removeMutation.isPending}
                style={{ background: 'none', border: 'none', color: fg, cursor: 'pointer', padding: 0, fontSize: fontSize + 1 }}
                aria-label="Remove link"
              >✕</button>
            </span>
          );
        })}
        {links.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
            title="Edit GC activity links"
            style={{
              background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 10,
              color: '#475569', fontSize, padding: '1px 6px', cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >+</button>
        )}
      </span>
      {modalOpen && (
        <PhaseGCLinkModal
          phaseItem={item}
          projectId={projectId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};

export default PhaseGCLinkChips;

/**
 * Tiny X button that unlinks all GC activities from a phase item. Used in
 * the date cells next to the chain icon so the user can quickly restore
 * manual date editing without opening the picker modal.
 */
export const UnlinkAllButton: React.FC<{ itemId: number; projectId: number; color?: string }> = ({ itemId, projectId, color = '#94a3b8' }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => phaseScheduleLinksApi.replaceForItem(itemId, []),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['phaseScheduleItems'] }),
  });
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); mutation.mutate(); }}
      disabled={mutation.isPending}
      title="Remove GC link (unlocks manual date editing)"
      aria-label="Unlink"
      style={{ background: 'transparent', border: 'none', color, cursor: 'pointer', padding: 0, fontSize: '0.7rem', lineHeight: 1 }}
    >✕</button>
  );
};
