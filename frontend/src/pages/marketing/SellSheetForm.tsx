import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellSheetsApi, SellSheet, SellSheetImage } from '../../services/sellSheets';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const SERVICE_SUGGESTIONS = [
  'HVAC',
  'Plumbing',
  'Industrial Piping',
  'Process Piping',
  'Industrial Sheet Metal',
  'Industrial Ventilation',
  'Custom Equipment Design',
  'Engineering',
  'Building Automation Systems',
  'Air Purification',
  'BIM',
  'Medical Gas',
  'Dust Collection',
  'Mechanical Fabrication',
  'Mechanical Engineering',
];

const SellSheetForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    service_name: '',
    title: '',
    subtitle: '',
    layout_style: 'full_width' as 'full_width' | 'two_column',
    overview: '',
    content: '',
    sidebar_content: '',
    page2_content: '',
    footer_content: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<SellSheetImage[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load existing sell sheet if editing
  const { data: sellSheet } = useQuery({
    queryKey: ['sellSheet', id],
    queryFn: () => sellSheetsApi.getById(parseInt(id!)).then(res => res.data),
    enabled: isEditMode,
  });

  // Populate form from existing sell sheet
  useEffect(() => {
    if (sellSheet) {
      setFormData({
        service_name: sellSheet.service_name || '',
        title: sellSheet.title || '',
        subtitle: sellSheet.subtitle || '',
        layout_style: sellSheet.layout_style || 'full_width',
        overview: sellSheet.overview || '',
        content: sellSheet.content || '',
        sidebar_content: sellSheet.sidebar_content || '',
        page2_content: sellSheet.page2_content || '',
        footer_content: sellSheet.footer_content || '',
      });
      if (sellSheet.images) {
        setImages(sellSheet.images);
      }
    }
  }, [sellSheet]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<SellSheet>) => sellSheetsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sellSheets'] });
      navigate(`/sell-sheets/${res.data.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SellSheet>) => sellSheetsApi.update(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellSheets'] });
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
      navigate(`/sell-sheets/${id}`);
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.service_name.trim()) {
      newErrors.service_name = 'Service name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const submitData: Partial<SellSheet> = {
      service_name: formData.service_name,
      title: formData.title || formData.service_name,
      subtitle: formData.subtitle || undefined,
      layout_style: formData.layout_style,
      overview: formData.overview || undefined,
      content: formData.content || undefined,
      sidebar_content: formData.layout_style === 'two_column' ? (formData.sidebar_content || undefined) : undefined,
      page2_content: formData.page2_content || undefined,
      footer_content: formData.footer_content || undefined,
    };

    if (isEditMode) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Image management handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setImageUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      const res = await sellSheetsApi.uploadImage(parseInt(id), uploadData);
      setImages(prev => [...prev, res.data]);
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSetHeroImage = async (imageId: number, isHero: boolean) => {
    try {
      await sellSheetsApi.updateImage(imageId, { is_hero_image: isHero });
      setImages(prev =>
        prev.map(img => ({
          ...img,
          is_hero_image: img.id === imageId ? isHero : (isHero ? false : img.is_hero_image),
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
    } catch (err) {
      console.error('Failed to update image:', err);
    }
  };

  const handleUpdateCaption = async (imageId: number, caption: string) => {
    try {
      await sellSheetsApi.updateImage(imageId, { caption });
      setImages(prev =>
        prev.map(img => (img.id === imageId ? { ...img, caption } : img))
      );
    } catch (err) {
      console.error('Failed to update caption:', err);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    const ok = await confirm({ message: 'Delete this image?', danger: true });
    if (!ok) return;
    try {
      await sellSheetsApi.deleteImage(imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
      queryClient.invalidateQueries({ queryKey: ['sellSheet', id] });
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  return (
    <div className="container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/sell-sheets" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Sell Sheets
            </Link>
            <h1>{isEditMode ? 'Edit Sell Sheet' : 'Create Sell Sheet'}</h1>
            <div className="sales-subtitle">{isEditMode ? 'Update sell sheet content' : 'Create a new service sell sheet'}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Basic Information
          </h3>

          <div className="form-group">
            <label className="form-label">
              Service Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              name="service_name"
              className="form-input"
              value={formData.service_name}
              onChange={handleChange}
              placeholder="e.g., HVAC, Plumbing, Industrial Piping"
              list="service-suggestions"
            />
            <datalist id="service-suggestions">
              {SERVICE_SUGGESTIONS.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.service_name && (
              <div className="error-message" style={{ marginTop: '0.25rem' }}>
                {errors.service_name}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              name="title"
              className="form-input"
              value={formData.title}
              onChange={handleChange}
              placeholder={formData.service_name ? `Defaults to "${formData.service_name}"` : 'Defaults to service name if empty'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input
              type="text"
              name="subtitle"
              className="form-input"
              value={formData.subtitle}
              onChange={handleChange}
              placeholder="e.g., Comprehensive mechanical solutions for your facility"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Layout Style</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="radio"
                  name="layout_style"
                  value="full_width"
                  checked={formData.layout_style === 'full_width'}
                  onChange={handleChange}
                  style={{ marginRight: '0.5rem' }}
                />
                Full Width
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="radio"
                  name="layout_style"
                  value="two_column"
                  checked={formData.layout_style === 'two_column'}
                  onChange={handleChange}
                  style={{ marginRight: '0.5rem' }}
                />
                Two Column
              </label>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Content
          </h3>

          <div className="form-group">
            <label className="form-label">Overview</label>
            <RichTextEditor
              value={formData.overview || ''}
              onChange={(value) => setFormData(prev => ({ ...prev, overview: value }))}
              placeholder="Introduction/overview paragraph..."
              minHeight="150px"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Content</label>
            <RichTextEditor
              value={formData.content || ''}
              onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
              placeholder="Main body content - use headings, lists, etc."
              minHeight="250px"
            />
          </div>

          {formData.layout_style === 'two_column' && (
            <div className="form-group">
              <label className="form-label">Sidebar Content</label>
              <RichTextEditor
                value={formData.sidebar_content || ''}
                onChange={(value) => setFormData(prev => ({ ...prev, sidebar_content: value }))}
                placeholder="Right-side panel content (service offerings list, etc.)"
                minHeight="200px"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Page 2 Content</label>
            <RichTextEditor
              value={formData.page2_content || ''}
              onChange={(value) => setFormData(prev => ({ ...prev, page2_content: value }))}
              placeholder="Optional second page content..."
              minHeight="200px"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Footer Content</label>
            <RichTextEditor
              value={formData.footer_content || ''}
              onChange={(value) => setFormData(prev => ({ ...prev, footer_content: value }))}
              placeholder="Locations, contact info, etc."
              minHeight="100px"
            />
          </div>
        </div>

        {/* Images - Edit Mode Only */}
        {isEditMode && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1rem', fontWeight: 600 }}>
              Images
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: 0, marginBottom: '1rem' }}>
              Upload images to include in the sell sheet. Set one as the hero image for the header banner.
            </p>

            {images.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem',
              }}>
                {images.map(img => (
                  <div
                    key={img.id}
                    style={{
                      border: img.is_hero_image ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <div style={{
                      width: '100%',
                      height: '140px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      backgroundColor: '#f3f4f6',
                    }}>
                      <img
                        src={(img as any).image_url || img.file_path}
                        alt={img.caption || img.file_name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Image caption..."
                        value={img.caption || ''}
                        onChange={(e) => handleUpdateCaption(img.id, e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', marginBottom: '0.5rem', width: '100%' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          color: img.is_hero_image ? '#3b82f6' : '#6b7280',
                          fontWeight: img.is_hero_image ? 600 : 400,
                        }}>
                          <input
                            type="checkbox"
                            checked={img.is_hero_image}
                            onChange={(e) => handleSetHeroImage(img.id, e.target.checked)}
                            style={{ marginRight: '0.35rem' }}
                          />
                          Hero Image
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
              >
                {imageUploading ? 'Uploading...' : 'Upload Image'}
              </button>
              {images.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  No images uploaded yet
                </span>
              )}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEditMode ? `/sell-sheets/${id}` : '/sell-sheets')}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : isEditMode
              ? 'Update Sell Sheet'
              : 'Create Sell Sheet'}
          </button>
        </div>

        {(createMutation.isError || updateMutation.isError) && (
          <div className="error-message" style={{ marginTop: '1rem' }}>
            Failed to save sell sheet. Please try again.
          </div>
        )}
      </form>
    </div>
  );
};

export default SellSheetForm;
