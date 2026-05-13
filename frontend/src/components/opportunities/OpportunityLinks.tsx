import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { OpportunityLink } from '../../services/opportunities';
import ConfirmModal from '../common/ConfirmModal';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import '../../styles/OpportunityLinks.css';

interface OpportunityLinksProps {
  opportunityId: number;
}

const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const OpportunityLinks: React.FC<OpportunityLinksProps> = ({ opportunityId }) => {
  const queryClient = useQueryClient();
  const queryKey = ['opportunities', opportunityId, 'links'];

  const [showAdd, setShowAdd] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [pendingDelete, setPendingDelete] = useState<OpportunityLink | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => opportunitiesService.getLinks(opportunityId),
  });

  const createMutation = useMutation({
    mutationFn: (url: string) => opportunitiesService.createLink(opportunityId, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setUrlInput('');
      setShowAdd(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || err?.message || 'Failed to add link';
      alert(`Could not add link: ${msg}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ linkId, url }: { linkId: number; url: string }) =>
      opportunitiesService.updateLink(opportunityId, linkId, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || err?.message || 'Failed to update link';
      alert(`Could not update link: ${msg}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: number) => opportunitiesService.deleteLink(opportunityId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setPendingDelete(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete link';
      alert(`Could not delete link: ${msg}`);
    },
  });

  const handleAddSubmit = () => {
    const url = normalizeUrl(urlInput);
    if (!url) return;
    createMutation.mutate(url);
  };

  const startEdit = (link: OpportunityLink) => {
    setEditingId(link.id);
    setEditUrl(link.url);
  };

  const handleEditSave = (link: OpportunityLink) => {
    const url = normalizeUrl(editUrl);
    if (!url) return;
    updateMutation.mutate({ linkId: link.id, url });
  };

  return (
    <div className="opportunity-links">
      <div className="opportunity-links-header">
        <h3 className="opportunity-links-title">Project Information Links</h3>
        {!showAdd && (
          <button type="button" className="btn-add-link" onClick={() => setShowAdd(true)}>
            <span>+</span> Add Link
          </button>
        )}
      </div>

      {showAdd && (
        <div className="link-form">
          <input
            type="url"
            className="link-form-url"
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            autoFocus
          />
          <div className="link-form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setShowAdd(false); setUrlInput(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAddSubmit}
              disabled={!urlInput.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="link-list">
        {isLoading ? (
          <div className="link-empty">Loading links...</div>
        ) : links.length === 0 ? (
          <div className="link-empty">No project links yet. Add one above to share plan rooms, drives, or RFP portals.</div>
        ) : (
          links.map((link) => (
            <div key={link.id} className="link-item">
              {editingId === link.id ? (
                <div className="link-edit">
                  <input
                    type="url"
                    className="link-form-url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    autoFocus
                  />
                  <div className="link-form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleEditSave(link)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-anchor"
                    title={link.url}
                  >
                    <OpenInNewIcon style={{ fontSize: 14 }} />
                    <span className="link-url">{link.url}</span>
                  </a>
                  <div className="link-meta">
                    {link.created_by_name && (
                      <span className="link-author">Added by {link.created_by_name}</span>
                    )}
                    <div className="link-actions">
                      <button
                        type="button"
                        className="link-action-btn"
                        onClick={() => startEdit(link)}
                        title="Edit"
                      >
                        <EditIcon style={{ fontSize: 14 }} />
                      </button>
                      <button
                        type="button"
                        className="link-action-btn"
                        onClick={() => setPendingDelete(link)}
                        title="Delete"
                      >
                        <DeleteIcon style={{ fontSize: 14 }} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete link?"
        message={
          pendingDelete
            ? `This will remove ${pendingDelete.url} from this opportunity.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default OpportunityLinks;
