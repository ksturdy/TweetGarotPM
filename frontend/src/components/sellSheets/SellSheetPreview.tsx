import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SellSheet } from '../../services/sellSheets';

interface PreviewImage {
  id: number;
  file_path: string;
  image_url?: string;
  is_hero_image: boolean;
  caption?: string;
}

interface SellSheetPreviewProps {
  sellSheet: SellSheet & { images?: PreviewImage[] };
}

const primaryColor = '#1e3a5f';

const getImageUrl = (image: any) => {
  if (image.image_url) return image.image_url;
  if (image.file_path) return `/api/uploads/${image.file_path}`;
  return '';
};

const SellSheetPreview: React.FC<SellSheetPreviewProps> = ({ sellSheet }) => {
  const { tenant } = useAuth();
  const logoUrl = (tenant as any)?.settings?.branding?.logo_url || '';
  const images = sellSheet.images || [];
  const heroImage = images.find(img => img.is_hero_image);
  const otherImages = images.filter(img => !img.is_hero_image);
  const layout = sellSheet.layout_style || 'full_width';

  if (layout === 'two_column') {
    return <TwoColumnPreview sellSheet={sellSheet} heroImage={heroImage} otherImages={otherImages} logoUrl={logoUrl} />;
  }
  return <FullWidthPreview sellSheet={sellSheet} heroImage={heroImage} otherImages={otherImages} logoUrl={logoUrl} />;
};

const FullWidthPreview: React.FC<{
  sellSheet: SellSheet;
  heroImage?: PreviewImage;
  otherImages: PreviewImage[];
  logoUrl?: string;
}> = ({ sellSheet, heroImage, otherImages, logoUrl }) => (
  <div style={{ padding: '0.5in', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt', lineHeight: 1.6, color: '#1a1a1a', position: 'relative', minHeight: '11in', backgroundColor: 'white' }}>
    {/* Header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: `3px solid ${primaryColor}`, paddingBottom: 15 }}>
      <div>
        <h1 style={{ fontSize: '22pt', fontWeight: 'bold', margin: '0 0 4px 0', color: primaryColor }}>
          {sellSheet.title || sellSheet.service_name}
        </h1>
        {sellSheet.subtitle && <div style={{ fontSize: '11pt', color: '#666' }}>{sellSheet.subtitle}</div>}
      </div>
    </div>

    {/* Overview */}
    {sellSheet.overview && (
      <div style={{ marginBottom: 16 }}>
        <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.overview }} />
      </div>
    )}

    {/* Hero Image */}
    {heroImage && (
      <div style={{ marginBottom: 16 }}>
        <img src={getImageUrl(heroImage)} alt="" style={{ width: '100%', maxHeight: 250, objectFit: 'cover', borderRadius: 4 }} />
      </div>
    )}

    {/* Image Grid */}
    {otherImages.length > 0 && (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(otherImages.length, 3)}, 1fr)`, gap: 8, marginBottom: 16 }}>
        {otherImages.slice(0, 3).map(img => (
          <img key={img.id} src={getImageUrl(img)} alt={img.caption || ''} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 4 }} />
        ))}
      </div>
    )}

    {/* Content */}
    {sellSheet.content && (
      <div style={{ marginBottom: 16 }}>
        <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.content }} />
      </div>
    )}

    {/* Page 2 Content */}
    {sellSheet.page2_content && (
      <div style={{ marginBottom: 16, borderTop: '2px solid #e5e7eb', paddingTop: 16 }}>
        <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.page2_content }} />
      </div>
    )}

    {/* Footer Logo */}
    {logoUrl && (
      <div style={{ position: 'absolute', bottom: 16, right: 40 }}>
        <img src={logoUrl} alt="Company Logo" style={{ width: 140, height: 'auto', maxHeight: 60, objectFit: 'contain' }} />
      </div>
    )}
  </div>
);

const TwoColumnPreview: React.FC<{
  sellSheet: SellSheet;
  heroImage?: PreviewImage;
  otherImages: PreviewImage[];
  logoUrl?: string;
}> = ({ sellSheet, heroImage, otherImages, logoUrl }) => (
  <div style={{ padding: '0.5in', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt', lineHeight: 1.6, color: '#1a1a1a', position: 'relative', minHeight: '11in', backgroundColor: 'white' }}>
    {/* Header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: `3px solid ${primaryColor}`, paddingBottom: 15 }}>
      <div>
        <h1 style={{ fontSize: '22pt', fontWeight: 'bold', margin: '0 0 4px 0', color: primaryColor }}>
          {sellSheet.title || sellSheet.service_name}
        </h1>
        {sellSheet.subtitle && <div style={{ fontSize: '11pt', color: '#666' }}>{sellSheet.subtitle}</div>}
      </div>
    </div>

    {/* Two Column Grid */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Left Column */}
      <div>
        {sellSheet.overview && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '14pt', fontWeight: 700, color: primaryColor, borderBottom: '2px solid #e5e7eb', paddingBottom: 6, margin: '0 0 10px 0' }}>Overview</h2>
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.overview }} />
          </div>
        )}

        {heroImage && (
          <div style={{ margin: '12px 0' }}>
            <img src={getImageUrl(heroImage)} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 4 }} />
          </div>
        )}

        {otherImages.length > 0 && otherImages.slice(0, 2).map(img => (
          <img key={img.id} src={getImageUrl(img)} alt={img.caption || ''} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 4, margin: '8px 0' }} />
        ))}

        {sellSheet.content && (
          <div style={{ marginBottom: 16 }}>
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.content }} />
          </div>
        )}
      </div>

      {/* Right Column */}
      <div>
        {sellSheet.sidebar_content && (
          <div>
            <h2 style={{ fontSize: '14pt', fontWeight: 700, color: primaryColor, borderBottom: '2px solid #e5e7eb', paddingBottom: 6, margin: '0 0 10px 0' }}>Service Offerings</h2>
            <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.sidebar_content }} />
          </div>
        )}
      </div>
    </div>

    {/* Page 2 Content */}
    {sellSheet.page2_content && (
      <div style={{ marginBottom: 16, borderTop: '2px solid #e5e7eb', paddingTop: 16, marginTop: 16 }}>
        <div className="cs-preview-content" dangerouslySetInnerHTML={{ __html: sellSheet.page2_content }} />
      </div>
    )}

    {/* Footer Logo */}
    {logoUrl && (
      <div style={{ position: 'absolute', bottom: 16, right: 40 }}>
        <img src={logoUrl} alt="Company Logo" style={{ width: 140, height: 'auto', maxHeight: 60, objectFit: 'contain' }} />
      </div>
    )}
  </div>
);

export default SellSheetPreview;
