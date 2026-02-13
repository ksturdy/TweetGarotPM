import React from 'react';
import { Link } from 'react-router-dom';
import './Branding.css';
import '../../styles/SalesPipeline.css';

const Branding: React.FC = () => {
  return (
    <div className="branding-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>🎨 Brand Guidelines</h1>
            <div className="sales-subtitle">Official brand identity standards for Tweet Garot Mechanical</div>
          </div>
        </div>
      </div>

      {/* Logo Guidelines Section */}
      <section className="brand-section">
        <h2 className="section-title">📋 Logo Guidelines</h2>
        <div className="section-content">
          <div className="guideline-card intro-card">
            <div className="intro-content">
              <div className="intro-text">
                <h3>Tweet Garot Logo</h3>
                <p>
                  The logo for Tweet Garot exists in a horizontal format. The logo should occupy its own space
                  and always maintain a generous "safe" area around it. The sample below shows the minimum 3/16" "safe" area.
                </p>
              </div>
              <div className="intro-logo-display">
                <svg viewBox="0 0 600 200" className="logo-svg">
                  {/* Safe area grid */}
                  <rect x="50" y="40" width="500" height="120" fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5"/>
                  <text x="30" y="105" fill="#747678" fontSize="12">3/16"</text>
                  {/* Tweet Garot Logo - matches PDF design */}
                  <text x="140" y="115" fill="#002356" fontSize="52" fontWeight="800" fontFamily="Arial, sans-serif">
                    tweet
                  </text>
                  {/* Circular icon with wrench - matches PDF */}
                  <g transform="translate(290, 75)">
                    <circle cx="0" cy="0" r="20" fill="#002356"/>
                    {/* Wrench/tool symbol inside circle */}
                    <path d="M -8 -5 L -5 -8 L 5 2 L 2 5 Z" fill="#FFFFFF"/>
                    <circle cx="8" cy="-8" r="6" fill="none" stroke="#FFFFFF" strokeWidth="2"/>
                    <path d="M 12 -12 L 15 -15 M 12 -4 L 15 -1" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
                  </g>
                  <text x="325" y="115" fill="#002356" fontSize="52" fontWeight="800" fontFamily="Arial, sans-serif">
                    garot
                  </text>
                </svg>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Logo Variations</h3>
            <div className="logo-variations-grid">
              <div className="logo-variation-item">
                <div className="logo-display-box">
                  <svg viewBox="0 0 400 120" className="logo-svg">
                    <text x="50" y="70" fill="#002356" fontSize="42" fontWeight="800" fontFamily="Arial, sans-serif">
                      tweet
                    </text>
                    <g transform="translate(175, 47)">
                      <circle cx="0" cy="0" r="16" fill="#002356"/>
                      <path d="M -6 -4 L -4 -6 L 4 2 L 2 4 Z" fill="#FFFFFF"/>
                      <circle cx="6" cy="-6" r="5" fill="none" stroke="#FFFFFF" strokeWidth="1.5"/>
                      <path d="M 9 -9 L 11 -11 M 9 -3 L 11 -1" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
                    </g>
                    <text x="200" y="70" fill="#002356" fontSize="42" fontWeight="800" fontFamily="Arial, sans-serif">
                      garot
                    </text>
                  </svg>
                </div>
                <p className="logo-label">Logo w/o Mechanical Descriptor</p>
                <p className="usage-note">✓ Recommended as primary logo</p>
              </div>

              <div className="logo-variation-item">
                <div className="logo-display-box">
                  <svg viewBox="0 0 400 140" className="logo-svg">
                    <text x="50" y="60" fill="#002356" fontSize="42" fontWeight="800" fontFamily="Arial, sans-serif">
                      tweet
                    </text>
                    <g transform="translate(175, 37)">
                      <circle cx="0" cy="0" r="16" fill="#002356"/>
                      <path d="M -6 -4 L -4 -6 L 4 2 L 2 4 Z" fill="#FFFFFF"/>
                      <circle cx="6" cy="-6" r="5" fill="none" stroke="#FFFFFF" strokeWidth="1.5"/>
                      <path d="M 9 -9 L 11 -11 M 9 -3 L 11 -1" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
                    </g>
                    <text x="200" y="60" fill="#002356" fontSize="42" fontWeight="800" fontFamily="Arial, sans-serif">
                      garot
                    </text>
                    <text x="210" y="100" fill="#004F8F" fontSize="18" fontWeight="600" fontFamily="Arial, sans-serif" letterSpacing="2">
                      mechanical
                    </text>
                  </svg>
                </div>
                <p className="logo-label">Logo with Mechanical Descriptor</p>
                <p className="usage-note">Use sparingly with marketing approval</p>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Color Variations</h3>
            <div className="color-variations-grid">
              <div className="color-var-item">
                <div className="logo-display-box navy-bg">
                  <svg viewBox="0 0 300 80" className="logo-svg">
                    <text x="40" y="50" fill="#FFFFFF" fontSize="32" fontWeight="800" fontFamily="Arial, sans-serif">
                      tweet
                    </text>
                    <g transform="translate(130, 37)">
                      <circle cx="0" cy="0" r="12" fill="#FFFFFF"/>
                      <path d="M -5 -3 L -3 -5 L 3 1 L 1 3 Z" fill="#002356"/>
                      <circle cx="4" cy="-4" r="3.5" fill="none" stroke="#002356" strokeWidth="1.2"/>
                      <path d="M 6 -6 L 8 -8 M 6 -2 L 8 0" stroke="#002356" strokeWidth="1.2" strokeLinecap="round"/>
                    </g>
                    <text x="150" y="50" fill="#FFFFFF" fontSize="32" fontWeight="800" fontFamily="Arial, sans-serif">
                      garot
                    </text>
                  </svg>
                </div>
                <p className="logo-label">Reversed on Navy (PMS 2757 C)</p>
              </div>
              <div className="color-var-item">
                <div className="logo-display-box black-bg">
                  <svg viewBox="0 0 300 80" className="logo-svg">
                    <text x="40" y="50" fill="#FFFFFF" fontSize="32" fontWeight="800" fontFamily="Arial, sans-serif">
                      tweet
                    </text>
                    <g transform="translate(130, 37)">
                      <circle cx="0" cy="0" r="12" fill="#FFFFFF"/>
                      <path d="M -5 -3 L -3 -5 L 3 1 L 1 3 Z" fill="#000000"/>
                      <circle cx="4" cy="-4" r="3.5" fill="none" stroke="#000000" strokeWidth="1.2"/>
                      <path d="M 6 -6 L 8 -8 M 6 -2 L 8 0" stroke="#000000" strokeWidth="1.2" strokeLinecap="round"/>
                    </g>
                    <text x="150" y="50" fill="#FFFFFF" fontSize="32" fontWeight="800" fontFamily="Arial, sans-serif">
                      garot
                    </text>
                  </svg>
                </div>
                <p className="logo-label">Reversed on Black</p>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Olney by Tweet Garot Sub-Brand</h3>
            <div className="olney-section">
              <div className="olney-logo-display">
                <svg viewBox="0 0 300 120" className="logo-svg">
                  <text x="60" y="60" fill="#002356" fontSize="48" fontWeight="800" fontFamily="Arial, sans-serif">
                    Olney
                  </text>
                  <g transform="translate(60, 75)">
                    <text x="0" y="0" fill="#747678" fontSize="10" fontFamily="Arial, sans-serif" letterSpacing="1">
                      by
                    </text>
                    <text x="20" y="0" fill="#747678" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="700">
                      tweet
                    </text>
                    <g transform="translate(50, -4)">
                      <circle cx="0" cy="0" r="5" fill="#2B923B"/>
                      <path d="M -2 -1.5 L -1.5 -2 L 1.5 0.5 L 0.5 1.5 Z" fill="#FFFFFF"/>
                      <circle cx="2" cy="-2" r="1.5" fill="none" stroke="#FFFFFF" strokeWidth="0.5"/>
                    </g>
                    <text x="60" y="0" fill="#747678" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="700">
                      garot
                    </text>
                  </g>
                </svg>
              </div>
              <div className="olney-info">
                <p><strong>Sub-Brand Guidelines:</strong></p>
                <ul>
                  <li>Uses PMS 802C green accent color (#2B923B)</li>
                  <li>Maintains Tweet Garot brand connection</li>
                  <li>Standard max width: 3.0 inches for apparel</li>
                  <li>Minimum height: 1.5 inches for embroidery</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Color Palette Section */}
      <section className="brand-section">
        <h2 className="section-title">🎨 Color Palette</h2>
        <div className="section-content">
          <div className="guideline-card">
            <h3>Primary Colors</h3>
            <div className="color-grid">
              <div className="color-card">
                <div className="color-swatch" style={{ backgroundColor: '#002356' }}></div>
                <div className="color-info">
                  <h4>Navy Blue</h4>
                  <p className="color-code-primary">Primary Brand Color</p>
                  <div className="color-codes">
                    <span><strong>PMS:</strong> 2757 C</span>
                    <span><strong>CMYK:</strong> C100 M82 Y8 K32</span>
                    <span><strong>RGB:</strong> R0 G35 B86</span>
                    <span><strong>HEX:</strong> #002356</span>
                  </div>
                </div>
              </div>

              <div className="color-card">
                <div className="color-swatch" style={{ backgroundColor: '#000000' }}></div>
                <div className="color-info">
                  <h4>Process Black</h4>
                  <p className="color-code-primary">Primary Text Color</p>
                  <div className="color-codes">
                    <span><strong>CMYK:</strong> C0 M0 Y0 K100</span>
                    <span><strong>RGB:</strong> R30 G30 B30</span>
                    <span><strong>HEX:</strong> #000000</span>
                  </div>
                </div>
              </div>

              <div className="color-card">
                <div className="color-swatch" style={{ backgroundColor: '#747678' }}></div>
                <div className="color-info">
                  <h4>Cool Gray 9 C</h4>
                  <p className="color-code-primary">Secondary/Text Color</p>
                  <div className="color-codes">
                    <span><strong>PMS:</strong> Cool Gray 9 C</span>
                    <span><strong>CMYK:</strong> C29 M23 Y16 K51</span>
                    <span><strong>RGB:</strong> R116 G118 B120</span>
                    <span><strong>HEX:</strong> #747678</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Accent Colors</h3>
            <div className="color-grid">
              <div className="color-card">
                <div className="color-swatch" style={{ backgroundColor: '#004F8F' }}></div>
                <div className="color-info">
                  <h4>Blue</h4>
                  <p className="color-code-accent">Accent Color</p>
                  <div className="color-codes">
                    <span><strong>PMS:</strong> 301 C</span>
                    <span><strong>CMYK:</strong> C100 M60 Y0 K25</span>
                    <span><strong>RGB:</strong> R0 G79 B143</span>
                    <span><strong>HEX:</strong> #004F8F</span>
                  </div>
                </div>
              </div>

              <div className="color-card">
                <div className="color-swatch" style={{ backgroundColor: '#F37B03' }}></div>
                <div className="color-info">
                  <h4>Orange</h4>
                  <p className="color-code-accent">Accent Color</p>
                  <div className="color-codes">
                    <span><strong>PMS:</strong> 158 C</span>
                    <span><strong>CMYK:</strong> C0 M49 Y99 K5</span>
                    <span><strong>RGB:</strong> R243 G123 B3</span>
                    <span><strong>HEX:</strong> #F37B03</span>
                  </div>
                </div>
              </div>

              <div className="color-card">
                <div className="color-swatch" style={{ backgroundColor: '#2B923B' }}></div>
                <div className="color-info">
                  <h4>Green</h4>
                  <p className="color-code-accent">Olney Accent Color</p>
                  <div className="color-codes">
                    <span><strong>PMS:</strong> 802C</span>
                    <span><strong>CMYK:</strong> C71 M0 Y60 K43</span>
                    <span><strong>RGB:</strong> R43 G146 B59</span>
                    <span><strong>HEX:</strong> #2B923B</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Typography Section */}
      <section className="brand-section">
        <h2 className="section-title">✍️ Typography</h2>
        <div className="section-content">
          <div className="guideline-card">
            <h3>Primary Typeface</h3>
            <div className="typography-showcase">
              <div className="font-display">
                <p className="font-name">ITC Officina Sans</p>
                <p className="font-sample-large">Aa Bb Cc Dd Ee Ff</p>
                <p className="font-sample-text">The quick brown fox jumps over the lazy dog</p>
                <div className="font-weights">
                  <span className="weight-sample book">Book</span>
                  <span className="weight-sample book-italic">Book Italic</span>
                  <span className="weight-sample bold">Bold</span>
                  <span className="weight-sample bold-italic">Bold Italic</span>
                </div>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Secondary Typeface</h3>
            <div className="typography-showcase">
              <div className="font-display">
                <p className="font-name">ITC Lubalin Graph Std Bold</p>
                <p className="font-sample-large secondary-font">Aa Bb Cc Dd Ee Ff</p>
                <p className="font-sample-text secondary-font">The quick brown fox jumps over the lazy dog</p>
                <p className="usage-note">Use for headlines and emphasis</p>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Alternative Typeface</h3>
            <div className="typography-showcase">
              <div className="font-display">
                <p className="font-name">Arial</p>
                <p className="font-sample-large" style={{ fontFamily: 'Arial, sans-serif' }}>Aa Bb Cc Dd Ee Ff</p>
                <p className="font-sample-text" style={{ fontFamily: 'Arial, sans-serif' }}>The quick brown fox jumps over the lazy dog</p>
                <p className="usage-note">Use when ITC Officina Sans is unavailable</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Apparel Standards Section */}
      <section className="brand-section">
        <h2 className="section-title">👕 Apparel Standards</h2>
        <div className="section-content">
          <div className="guideline-card">
            <h3>Logo Apparel Standards</h3>
            <div className="apparel-showcase">
              <div className="apparel-visual">
                <svg viewBox="0 0 300 400" className="apparel-svg">
                  {/* Quarter-zip pullover outline */}
                  <path d="M 80 80 Q 150 60 220 80 L 220 380 L 80 380 Z" fill="#002356" stroke="#001a3d" strokeWidth="2"/>
                  <path d="M 145 80 L 155 80 L 155 140 L 145 140 Z" fill="#7a8a99" stroke="#5a6a79" strokeWidth="1"/>
                  {/* Collar */}
                  <ellipse cx="150" cy="75" rx="25" ry="8" fill="#001a3d"/>
                  {/* Sleeves */}
                  <path d="M 80 80 Q 40 120 45 200 L 65 195 Q 70 130 80 110 Z" fill="#002356" stroke="#001a3d" strokeWidth="2"/>
                  <path d="M 220 80 Q 260 120 255 200 L 235 195 Q 230 130 220 110 Z" fill="#002356" stroke="#001a3d" strokeWidth="2"/>
                  {/* Logo placement - left chest */}
                  <rect x="95" y="140" width="70" height="20" fill="#FFFFFF" opacity="0.9" rx="2"/>
                  <text x="110" y="154" fill="#002356" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                    tweet
                  </text>
                  <g transform="translate(130, 148)">
                    <circle cx="0" cy="0" r="4" fill="#002356"/>
                    <path d="M -1.5 -1 L -1 -1.5 L 1 0.5 L 0.5 1 Z" fill="#FFFFFF"/>
                    <circle cx="1.2" cy="-1.2" r="1" fill="none" stroke="#FFFFFF" strokeWidth="0.5"/>
                  </g>
                  <text x="150" y="154" fill="#002356" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                    garot
                  </text>
                  {/* Logo placement indicator */}
                  <circle cx="90" cy="150" r="3" fill="#F37B03"/>
                  <text x="75" y="135" fill="#F37B03" fontSize="10" fontWeight="600">2.5"</text>
                  <line x1="90" y1="140" x2="90" y2="160" stroke="#F37B03" strokeWidth="1"/>
                </svg>
              </div>
              <div className="apparel-specs">
                <h4>Size & Placement Guidelines</h4>
                <div className="specs-grid">
                  <div className="spec-item highlight">
                    <span className="spec-label">Standard Maximum Width:</span>
                    <span className="spec-value">2.5 inches</span>
                  </div>
                  <div className="spec-item highlight">
                    <span className="spec-label">Outerwear/Hoodies Max Width:</span>
                    <span className="spec-value">3.0 inches</span>
                  </div>
                  <div className="spec-item highlight">
                    <span className="spec-label">Minimum Embroidery Height:</span>
                    <span className="spec-value">5mm (0.2 inches)</span>
                  </div>
                  <div className="spec-item highlight">
                    <span className="spec-label">Primary Placement:</span>
                    <span className="spec-value">Left chest</span>
                  </div>
                  <div className="spec-item highlight">
                    <span className="spec-label">Secondary Placement:</span>
                    <span className="spec-value">Right sleeve</span>
                  </div>
                </div>
                <p className="apparel-note">
                  <strong>Note:</strong> The standard Tweet Garot logo without the mechanical descriptor
                  should be used on all branded apparel, hats, and promotional items.
                </p>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Placement Guidelines</h3>
            <div className="placement-grid">
              <div className="placement-item">
                <div className="placement-diagram left-chest">
                  <div className="logo-position">LOGO</div>
                  <span className="placement-label">Left Chest</span>
                </div>
                <p className="placement-desc">Primary placement for shirts and jackets</p>
              </div>
              <div className="placement-item">
                <div className="placement-diagram right-sleeve">
                  <div className="logo-position">LOGO</div>
                  <span className="placement-label">Right Sleeve</span>
                </div>
                <p className="placement-desc">Secondary placement option</p>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Embroidery vs. Screen Printing</h3>
            <div className="method-comparison">
              <div className="method-card">
                <h4>🧵 Embroidery</h4>
                <ul>
                  <li>Professional appearance</li>
                  <li>Durable and long-lasting</li>
                  <li>Best for polos, jackets, hats</li>
                  <li>Minimum height: 5mm (0.2")</li>
                  <li>Maximum stitch count considerations</li>
                </ul>
              </div>
              <div className="method-card">
                <h4>🖨️ Screen Printing</h4>
                <ul>
                  <li>Cost-effective for large runs</li>
                  <li>Best for t-shirts</li>
                  <li>Can achieve finer details</li>
                  <li>Use PMS 2757 C or closest match</li>
                  <li>Ensure proper color matching</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vehicle Branding Section */}
      <section className="brand-section">
        <h2 className="section-title">🚗 Vehicle Branding</h2>
        <div className="section-content">
          <div className="guideline-card">
            <h3>Vehicle Branding Overview</h3>
            <p className="section-description">
              Consistent vehicle branding reinforces Tweet Garot's professional image in the field.
              All company vehicles should display the Tweet Garot logo and contact information following these standards.
            </p>
          </div>

          <div className="guideline-card">
            <h3>Color Standards for Vehicles</h3>
            <div className="vehicle-colors">
              <div className="vehicle-color-item">
                <div className="color-swatch" style={{ backgroundColor: '#002356' }}></div>
                <div>
                  <p><strong>Primary: PMS 2757 C Navy Blue</strong></p>
                  <p className="color-usage">Main logo and text color</p>
                </div>
              </div>
              <div className="vehicle-color-item">
                <div className="color-swatch" style={{ backgroundColor: '#004F8F' }}></div>
                <div>
                  <p><strong>Secondary: PMS 301 C Blue</strong></p>
                  <p className="color-usage">Accent elements and graphics</p>
                </div>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Vehicle Examples</h3>

            {/* Van Example */}
            <div className="vehicle-example">
              <h4>Transit Van - Full Wrap</h4>
              <svg viewBox="0 0 800 350" className="vehicle-svg">
                {/* Van body - white */}
                <rect x="100" y="120" width="580" height="160" fill="#FFFFFF" stroke="#888" strokeWidth="2" rx="5"/>
                <rect x="100" y="120" width="120" height="160" fill="#d0d0d0" stroke="#888" strokeWidth="2" rx="5"/>
                {/* Navy stripe */}
                <rect x="100" y="200" width="580" height="50" fill="#002356"/>
                {/* Blue accent stripe */}
                <rect x="100" y="190" width="580" height="10" fill="#004F8F"/>
                {/* Windows */}
                <rect x="115" y="135" width="40" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                <rect x="165" y="135" width="40" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                <rect x="500" y="135" width="160" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                {/* Logo on side */}
                <text x="325" y="165" fill="#002356" fontSize="36" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  tweet
                </text>
                <g transform="translate(380, 145)">
                  <circle cx="0" cy="0" r="15" fill="#002356"/>
                  <path d="M -6 -4 L -4 -6 L 4 2 L 2 4 Z" fill="#FFFFFF"/>
                  <circle cx="5" cy="-5" r="4" fill="none" stroke="#FFFFFF" strokeWidth="1.5"/>
                  <path d="M 8 -8 L 10 -10 M 8 -2 L 10 0" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
                </g>
                <text x="435" y="165" fill="#002356" fontSize="36" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  garot
                </text>
                {/* Services text on navy stripe */}
                <text x="380" y="228" fill="#FFFFFF" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="Arial">
                  HVAC | PLUMBING | PROCESS PIPING | BUILDING AUTOMATION | SERVICE
                </text>
                {/* Wheels */}
                <circle cx="200" cy="280" r="30" fill="#333" stroke="#000" strokeWidth="2"/>
                <circle cx="200" cy="280" r="15" fill="#888"/>
                <circle cx="580" cy="280" r="30" fill="#333" stroke="#000" strokeWidth="2"/>
                <circle cx="580" cy="280" r="15" fill="#888"/>
                {/* Mirror */}
                <rect x="90" y="160" width="15" height="20" fill="#333" stroke="#000" strokeWidth="1"/>
              </svg>
              <p className="vehicle-desc">Transit van with full side panel branding featuring logo and service list</p>
            </div>

            {/* Truck Example */}
            <div className="vehicle-example">
              <h4>Service Truck - Door Graphics</h4>
              <svg viewBox="0 0 800 300" className="vehicle-svg">
                {/* Truck cab - white */}
                <rect x="100" y="140" width="200" height="100" fill="#FFFFFF" stroke="#888" strokeWidth="2" rx="3"/>
                {/* Windshield */}
                <rect x="250" y="150" width="40" height="60" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                {/* Side window */}
                <rect x="120" y="150" width="60" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                {/* Navy stripe on door */}
                <rect x="100" y="190" width="120" height="35" fill="#002356"/>
                {/* Blue accent */}
                <rect x="100" y="185" width="120" height="5" fill="#004F8F"/>
                {/* Logo on door */}
                <text x="140" y="165" fill="#002356" fontSize="16" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  tweet
                </text>
                <g transform="translate(165, 157)">
                  <circle cx="0" cy="0" r="7" fill="#002356"/>
                  <path d="M -3 -2 L -2 -3 L 2 1 L 1 2 Z" fill="#FFFFFF"/>
                  <circle cx="2.5" cy="-2.5" r="2" fill="none" stroke="#FFFFFF" strokeWidth="0.8"/>
                </g>
                <text x="180" y="165" fill="#002356" fontSize="16" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  garot
                </text>
                {/* Services on stripe */}
                <text x="160" y="210" fill="#FFFFFF" fontSize="6" fontWeight="600" textAnchor="middle" fontFamily="Arial">
                  HVAC | PLUMBING | SERVICE
                </text>
                {/* Truck bed */}
                <rect x="300" y="160" width="280" height="80" fill="#FFFFFF" stroke="#888" strokeWidth="2"/>
                <rect x="300" y="180" width="280" height="30" fill="#002356"/>
                <text x="410" y="200" fill="#FFFFFF" fontSize="14" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  tweet
                </text>
                <g transform="translate(440, 192)">
                  <circle cx="0" cy="0" r="6" fill="#FFFFFF"/>
                  <path d="M -2.5 -1.5 L -1.5 -2.5 L 1.5 0.5 L 0.5 1.5 Z" fill="#002356"/>
                  <circle cx="2" cy="-2" r="1.5" fill="none" stroke="#002356" strokeWidth="0.7"/>
                </g>
                <text x="470" y="200" fill="#FFFFFF" fontSize="14" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  garot
                </text>
                {/* Wheels */}
                <circle cx="180" cy="240" r="25" fill="#333" stroke="#000" strokeWidth="2"/>
                <circle cx="180" cy="240" r="12" fill="#888"/>
                <circle cx="520" cy="240" r="25" fill="#333" stroke="#000" strokeWidth="2"/>
                <circle cx="520" cy="240" r="12" fill="#888"/>
              </svg>
              <p className="vehicle-desc">Service truck with door graphics and bed panel branding</p>
            </div>

            {/* SUV Example */}
            <div className="vehicle-example">
              <h4>SUV - Minimal Branding</h4>
              <svg viewBox="0 0 600 250" className="vehicle-svg">
                {/* SUV body - white */}
                <rect x="80" y="100" width="400" height="90" fill="#FFFFFF" stroke="#888" strokeWidth="2" rx="8"/>
                {/* Windows */}
                <rect x="360" y="110" width="100" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                <rect x="250" y="110" width="90" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                <rect x="140" y="110" width="90" height="50" fill="#7a9bb5" stroke="#444" strokeWidth="1"/>
                {/* Navy stripe */}
                <rect x="80" y="150" width="350" height="25" fill="#002356"/>
                {/* Blue accent */}
                <rect x="80" y="145" width="350" height="5" fill="#004F8F"/>
                {/* Logo */}
                <text x="230" y="168" fill="#FFFFFF" fontSize="12" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  tweet
                </text>
                <g transform="translate(255, 161)">
                  <circle cx="0" cy="0" r="5" fill="#FFFFFF"/>
                  <path d="M -2 -1.2 L -1.2 -2 L 1.2 0.4 L 0.4 1.2 Z" fill="#002356"/>
                  <circle cx="1.5" cy="-1.5" r="1.2" fill="none" stroke="#002356" strokeWidth="0.6"/>
                </g>
                <text x="280" y="168" fill="#FFFFFF" fontSize="12" fontWeight="800" textAnchor="middle" fontFamily="Arial">
                  garot
                </text>
                {/* Wheels */}
                <circle cx="160" cy="190" r="22" fill="#333" stroke="#000" strokeWidth="2"/>
                <circle cx="160" cy="190" r="10" fill="#888"/>
                <circle cx="400" cy="190" r="22" fill="#333" stroke="#000" strokeWidth="2"/>
                <circle cx="400" cy="190" r="10" fill="#888"/>
              </svg>
              <p className="vehicle-desc">Company SUV with door stripe and logo placement</p>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Required Elements</h3>
            <ul className="requirements-list">
              <li>✓ Tweet Garot logo (primary or horizontal format)</li>
              <li>✓ Company phone number</li>
              <li>✓ Website URL (optional but recommended)</li>
              <li>✓ "MECHANICAL" descriptor when space allows</li>
              <li>✓ Consistent color usage (PMS 2757 C and PMS 301 C)</li>
            </ul>
          </div>

          <div className="guideline-card">
            <h3>Installation Notes</h3>
            <div className="installation-notes">
              <p>📏 <strong>Vinyl Graphics:</strong> Use high-quality automotive vinyl rated for outdoor use</p>
              <p>🎨 <strong>Color Matching:</strong> Ensure PMS colors are accurately matched during printing</p>
              <p>🔧 <strong>Professional Installation:</strong> Use certified installers for best results</p>
              <p>🧼 <strong>Maintenance:</strong> Regular cleaning maintains brand appearance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Usage Guidelines */}
      <section className="brand-section">
        <h2 className="section-title">📖 General Usage Guidelines</h2>
        <div className="section-content">
          <div className="guideline-card">
            <h3>Do's and Don'ts</h3>
            <div className="dos-donts-grid">
              <div className="dos-column">
                <h4 className="dos-header">✅ Do</h4>
                <ul>
                  <li>Maintain proper logo clear space</li>
                  <li>Use approved color combinations</li>
                  <li>Ensure minimum size requirements</li>
                  <li>Use approved typefaces</li>
                  <li>Keep logos crisp and legible</li>
                  <li>Follow placement guidelines</li>
                </ul>
              </div>
              <div className="donts-column">
                <h4 className="donts-header">❌ Don't</h4>
                <ul>
                  <li>Distort or stretch the logo</li>
                  <li>Change logo colors arbitrarily</li>
                  <li>Add effects or shadows to logo</li>
                  <li>Use non-approved typefaces</li>
                  <li>Place logo on busy backgrounds</li>
                  <li>Rotate or angle the logo</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="guideline-card">
            <h3>Contact Information</h3>
            <p className="contact-info">
              For questions about brand guidelines or to request logo files,
              please contact the Marketing Department.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Branding;
