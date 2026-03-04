/**
 * Seed script to populate sell sheets with real content for all Tweet Garot service lines.
 * Run: node src/seeds/seedSellSheets.js
 */
require('dotenv').config();
const pool = require('../config/database');

const TENANT_ID = 1;
const CREATED_BY = 7; // kipp.sturdivant@tweetgarot.com

const sellSheets = [
  // ============================================================
  // 1. Industrial Piping — TWO COLUMN (matches example PDF)
  // ============================================================
  {
    service_name: 'Industrial Piping',
    title: 'Industrial Piping Solutions',
    subtitle: 'Comprehensive Piping Systems for Industrial Facilities',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical delivers comprehensive industrial piping solutions for manufacturing, processing, and industrial facilities throughout Wisconsin and beyond. With decades of experience and a team of certified pipefitters, we design, fabricate, and install piping systems that meet the most demanding specifications.</p>
<p>Our commitment to safety, quality, and innovation ensures that every project is completed on time, within budget, and to the highest industry standards. From initial design through final commissioning, Tweet/Garot is your trusted partner for industrial piping excellence.</p>`,
    content: `<h3>Innovation & Safety</h3>
<p>At Tweet/Garot, safety isn't just a priority — it's a core value. Our comprehensive safety program includes:</p>
<ul>
<li>OSHA 30-hour certified supervision on every project</li>
<li>Daily safety briefings and hazard assessments</li>
<li>Zero-incident safety culture with industry-leading EMR</li>
<li>Regular third-party safety audits and continuous improvement</li>
</ul>
<h3>Quality Assurance</h3>
<p>Every weld, every joint, every connection is inspected and documented. Our quality program includes certified weld inspectors, radiographic testing capabilities, and full material traceability from supplier to installation.</p>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>Process Piping Systems</strong> — Steam, condensate, compressed air, and specialty gas systems</li>
<li><strong>Utility Piping</strong> — Water, waste, and storm drainage systems</li>
<li><strong>High-Purity Piping</strong> — Clean-in-place (CIP) and sanitary piping for food & beverage</li>
<li><strong>Fire Protection Piping</strong> — Sprinkler systems and standpipe installations</li>
<li><strong>Chilled & Hot Water Systems</strong> — Hydronic distribution piping</li>
<li><strong>Refrigeration Piping</strong> — Ammonia and glycol systems</li>
<li><strong>Underground Utilities</strong> — Below-grade piping and infrastructure</li>
<li><strong>Pipe Fabrication</strong> — Custom prefabrication in our in-house shop</li>
<li><strong>Piping Maintenance & Repair</strong> — 24/7 emergency service available</li>
</ul>`,
    page2_content: `<h2>Project Capabilities</h2>
<p>Tweet/Garot has successfully completed industrial piping projects ranging from small tenant improvements to multi-million dollar facility build-outs. Our capabilities include:</p>
<ul>
<li>Carbon steel, stainless steel, copper, PVC, CPVC, and specialty alloy piping</li>
<li>Pipe sizes from ½" through 36" and beyond</li>
<li>High-pressure systems up to 3,000 PSI</li>
<li>Cryogenic and high-temperature applications</li>
<li>BIM/3D coordination and prefabrication</li>
<li>Shutdown and turnaround expertise</li>
</ul>
<h2>Industries Served</h2>
<ul>
<li>Food & Beverage Processing</li>
<li>Paper & Pulp Mills</li>
<li>Power Generation</li>
<li>Chemical & Petrochemical</li>
<li>Water & Wastewater Treatment</li>
<li>Manufacturing & Assembly</li>
<li>Pharmaceutical & Biotech</li>
</ul>`,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 1,
  },

  // ============================================================
  // 2. Mechanical Fabrication — FULL WIDTH (matches example PDF)
  // ============================================================
  {
    service_name: 'Mechanical Fabrication',
    title: 'Mechanical Fabrication Services',
    subtitle: 'Custom Metal Fabrication & Welding Solutions',
    layout_style: 'full_width',
    overview: `<p>Tweet/Garot Mechanical's in-house fabrication shop provides custom metal fabrication and welding services to support our mechanical construction projects and serve the broader industrial community. Our state-of-the-art facility is equipped with the latest CNC machinery, welding stations, and quality control equipment to deliver precision fabrication on any scale.</p>`,
    content: `<h3>Fabrication Capabilities</h3>
<ul>
<li><strong>Custom Pipe Fabrication</strong> — Spool pieces, headers, manifolds, and specialty assemblies in carbon steel, stainless steel, and alloys</li>
<li><strong>Sheet Metal Fabrication</strong> — Ductwork, enclosures, platforms, guards, and architectural metalwork</li>
<li><strong>Structural Steel</strong> — Equipment supports, pipe racks, mezzanines, and platforms</li>
<li><strong>Vessel & Tank Fabrication</strong> — Custom pressure vessels, storage tanks, and process equipment</li>
<li><strong>Welding Services</strong> — SMAW, GMAW, GTAW, FCAW certified to ASME and AWS standards</li>
<li><strong>CNC Plasma & Laser Cutting</strong> — Precision cutting of plate, pipe, and structural shapes</li>
<li><strong>Rolling & Forming</strong> — Plate rolling, brake forming, and specialty bending</li>
</ul>
<h3>Quality & Certifications</h3>
<p>Our fabrication shop maintains rigorous quality standards including:</p>
<ul>
<li>ASME Section IX qualified welding procedures</li>
<li>AWS D1.1 Structural Welding certification</li>
<li>Certified Weld Inspectors (CWI) on staff</li>
<li>Full NDE capabilities — RT, UT, MT, PT</li>
<li>Complete material traceability and documentation</li>
</ul>`,
    sidebar_content: null,
    page2_content: `<h2>Prefabrication Advantage</h2>
<p>By fabricating piping spools, ductwork sections, and equipment assemblies in our controlled shop environment, we deliver significant advantages to our customers:</p>
<ul>
<li><strong>Improved Quality</strong> — Shop fabrication in a controlled environment produces superior welds and tighter tolerances</li>
<li><strong>Faster Installation</strong> — Prefabricated assemblies reduce on-site labor hours by 30-50%</li>
<li><strong>Enhanced Safety</strong> — Reducing field welding and overhead work minimizes jobsite risk</li>
<li><strong>Cost Savings</strong> — Higher productivity and less rework translate to lower project costs</li>
<li><strong>Schedule Certainty</strong> — Shop work can proceed independent of weather or site conditions</li>
</ul>
<h2>Capacity & Equipment</h2>
<ul>
<li>20,000 sq. ft. fabrication facility</li>
<li>Overhead crane capacity up to 10 tons</li>
<li>CNC plasma cutting table — 5' x 10' capacity</li>
<li>Pipe beveling machines up to 36"</li>
<li>Plate rolls up to 1" x 10'</li>
<li>Multiple welding stations with positioners</li>
<li>Dedicated clean room for stainless steel fabrication</li>
</ul>`,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 2,
  },

  // ============================================================
  // 3. HVAC
  // ============================================================
  {
    service_name: 'HVAC',
    title: 'HVAC Systems & Solutions',
    subtitle: 'Heating, Ventilation & Air Conditioning for Every Application',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical is a full-service HVAC contractor providing design, installation, and service of heating, ventilation, and air conditioning systems for commercial, industrial, and institutional facilities. Our experienced team delivers energy-efficient comfort solutions tailored to each client's unique needs.</p>
<p>From single-building retrofits to multi-facility campus systems, we bring the expertise, workforce, and project management capabilities to deliver results on any scale.</p>`,
    content: `<h3>Design-Build Expertise</h3>
<p>Our in-house engineering team works directly with building owners and architects to design HVAC systems that optimize comfort, energy efficiency, and lifecycle cost. We leverage the latest energy modeling tools and BIM technology to deliver innovative solutions.</p>
<h3>Energy Efficiency</h3>
<ul>
<li>Energy audits and system optimization</li>
<li>Heat recovery and economizer systems</li>
<li>Variable frequency drive (VFD) retrofits</li>
<li>High-efficiency equipment selection and installation</li>
<li>LEED and green building support</li>
</ul>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>Rooftop Units (RTUs)</strong> — Installation, replacement, and upgrades</li>
<li><strong>Chillers & Cooling Towers</strong> — Centrifugal, screw, and air-cooled systems</li>
<li><strong>Boilers & Heating</strong> — Hot water, steam, and radiant heating systems</li>
<li><strong>Air Handling Units</strong> — Custom and packaged AHU systems</li>
<li><strong>Split Systems & VRF</strong> — Variable refrigerant flow and mini-split installations</li>
<li><strong>Ductwork</strong> — Sheet metal, spiral, and flexible duct systems</li>
<li><strong>Controls & Automation</strong> — DDC controls and BAS integration</li>
<li><strong>Preventive Maintenance</strong> — Scheduled PM programs and service agreements</li>
<li><strong>24/7 Emergency Service</strong> — Round-the-clock response for critical systems</li>
</ul>`,
    page2_content: `<h2>Markets Served</h2>
<ul>
<li>K-12 Schools & Universities</li>
<li>Healthcare & Hospitals</li>
<li>Office Buildings & Corporate Campuses</li>
<li>Retail & Hospitality</li>
<li>Manufacturing & Warehousing</li>
<li>Government & Municipal Facilities</li>
<li>Data Centers</li>
<li>Food & Beverage Processing</li>
</ul>
<h2>Why Tweet/Garot for HVAC?</h2>
<ul>
<li>Licensed mechanical contractors in Wisconsin, Michigan, and Minnesota</li>
<li>Factory-trained technicians on all major equipment brands</li>
<li>In-house sheet metal shop for custom ductwork fabrication</li>
<li>BIM/3D coordination for complex installations</li>
<li>Self-performing workforce — no subcontracting of core work</li>
<li>Proven track record on projects from $50K to $20M+</li>
</ul>`,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 3,
  },

  // ============================================================
  // 4. Plumbing
  // ============================================================
  {
    service_name: 'Plumbing',
    title: 'Commercial & Industrial Plumbing',
    subtitle: 'Complete Plumbing Solutions from Design Through Service',
    layout_style: 'full_width',
    overview: `<p>Tweet/Garot Mechanical provides comprehensive plumbing services for commercial, industrial, and institutional projects. Our licensed plumbers bring decades of experience to every project, from new construction and major renovations to tenant improvements and emergency repairs.</p>`,
    content: `<h3>Plumbing Services</h3>
<ul>
<li><strong>Domestic Water Systems</strong> — Hot and cold water distribution, booster pumps, and water heaters</li>
<li><strong>Sanitary Waste & Vent</strong> — Gravity drainage, ejector systems, and grease interceptors</li>
<li><strong>Storm Drainage</strong> — Roof drains, area drains, and retention/detention systems</li>
<li><strong>Natural Gas Piping</strong> — Service lines, distribution piping, and appliance connections</li>
<li><strong>Medical Gas Systems</strong> — Oxygen, vacuum, nitrogen, and medical air piping</li>
<li><strong>Fixture Installation</strong> — Commercial restrooms, kitchen equipment, and specialty fixtures</li>
<li><strong>Backflow Prevention</strong> — Installation, testing, and annual certification</li>
<li><strong>Water Treatment</strong> — Softeners, filtration, and water quality systems</li>
</ul>
<h3>Plumbing Maintenance & Service</h3>
<p>Our service department provides preventive maintenance programs, emergency response, and ongoing support to keep your plumbing systems operating reliably. We offer 24/7 emergency service with rapid response times throughout our service area.</p>`,
    sidebar_content: null,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 4,
  },

  // ============================================================
  // 5. Process Piping
  // ============================================================
  {
    service_name: 'Process Piping',
    title: 'Process Piping Systems',
    subtitle: 'Precision Piping for Manufacturing & Processing Applications',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical specializes in the design, fabrication, and installation of process piping systems for manufacturing, food & beverage, pharmaceutical, and chemical processing facilities. Our certified pipefitters and welders deliver the precision and quality that process applications demand.</p>
<p>We understand that process piping systems are the lifeline of your operation. Our team works closely with process engineers to ensure every system meets exacting specifications for pressure, temperature, cleanliness, and material compatibility.</p>`,
    content: `<h3>Expertise & Capabilities</h3>
<ul>
<li>ASME B31.1 and B31.3 compliant installations</li>
<li>Sanitary (3-A) piping for food & beverage applications</li>
<li>High-purity orbital welding for pharmaceutical and biotech</li>
<li>Steam and condensate systems up to 600 PSI</li>
<li>Ammonia refrigeration piping (IIAR compliant)</li>
<li>Chemical transfer and waste treatment piping</li>
<li>Compressed air and specialty gas distribution</li>
</ul>
<h3>Materials</h3>
<p>We work with all common and specialty piping materials including carbon steel, 304/316 stainless steel, alloy 20, Hastelloy, titanium, CPVC, PVDF, and polypropylene.</p>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>Process System Design</strong> — P&ID development and system engineering</li>
<li><strong>Pipe Fabrication</strong> — In-house prefabrication with full QC</li>
<li><strong>CIP Systems</strong> — Clean-in-place piping and components</li>
<li><strong>Steam & Condensate</strong> — Generation, distribution, and recovery</li>
<li><strong>Compressed Air</strong> — Plant air, instrument air, and specialty gas</li>
<li><strong>Chemical Systems</strong> — Chemical feed, storage, and containment</li>
<li><strong>Glycol & Brine</strong> — Secondary refrigerant piping systems</li>
<li><strong>Shutdown Services</strong> — Planned outage and turnaround support</li>
</ul>`,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 5,
  },

  // ============================================================
  // 6. Industrial Sheet Metal
  // ============================================================
  {
    service_name: 'Industrial Sheet Metal',
    title: 'Industrial Sheet Metal',
    subtitle: 'Custom Sheet Metal Fabrication & Installation',
    layout_style: 'full_width',
    overview: `<p>Tweet/Garot Mechanical's sheet metal division provides custom fabrication and installation services for industrial, commercial, and institutional facilities. Our in-house sheet metal shop and skilled workforce deliver precision ductwork, enclosures, and specialty metalwork for any application.</p>`,
    content: `<h3>Sheet Metal Services</h3>
<ul>
<li><strong>HVAC Ductwork</strong> — Rectangular, round, and oval duct systems to SMACNA standards</li>
<li><strong>Industrial Exhaust</strong> — Fume exhaust, welding exhaust, and process ventilation ductwork</li>
<li><strong>Stainless Steel Ductwork</strong> — For food processing, pharmaceutical, and corrosive environments</li>
<li><strong>Kitchen Exhaust Hoods</strong> — Type I and Type II commercial kitchen hood systems</li>
<li><strong>Architectural Metalwork</strong> — Louvers, grilles, diffusers, and decorative metalwork</li>
<li><strong>Equipment Enclosures</strong> — Machine guards, panels, covers, and access doors</li>
<li><strong>Insulated Panels</strong> — Insulated ductwork and wall panels for thermal applications</li>
</ul>
<h3>In-House Shop Capabilities</h3>
<p>Our fully equipped sheet metal shop features CNC plasma cutting, automated duct fabrication lines, Pittsburgh lock and TDC/TDF forming machines, and a complete inventory of standard fittings and accessories. This allows us to respond quickly to project needs and maintain tight quality control.</p>`,
    sidebar_content: null,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 6,
  },

  // ============================================================
  // 7. Industrial Ventilation
  // ============================================================
  {
    service_name: 'Industrial Ventilation',
    title: 'Industrial Ventilation Systems',
    subtitle: 'Engineered Air Quality Solutions for Industrial Environments',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical designs and installs industrial ventilation systems that protect worker health, maintain product quality, and ensure regulatory compliance. From localized exhaust ventilation to plant-wide air management, we deliver engineered solutions for the most challenging industrial environments.</p>
<p>Our ventilation engineers work with industrial hygienists and facility managers to develop systems that effectively capture and control airborne contaminants while optimizing energy consumption.</p>`,
    content: `<h3>Engineering Approach</h3>
<p>Every industrial ventilation project starts with a thorough assessment of the work environment, contaminant sources, and regulatory requirements. We use computational fluid dynamics (CFD) modeling and industry-standard design methodologies to engineer systems that perform reliably and efficiently.</p>
<h3>Regulatory Compliance</h3>
<ul>
<li>OSHA permissible exposure limits (PELs)</li>
<li>ACGIH industrial ventilation guidelines</li>
<li>NFPA standards for combustible dust</li>
<li>EPA air quality regulations</li>
<li>Local air permit requirements</li>
</ul>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>Local Exhaust Ventilation</strong> — Hoods, booths, and capture systems</li>
<li><strong>General Dilution Ventilation</strong> — Plant-wide air exchange systems</li>
<li><strong>Welding Fume Extraction</strong> — Source capture and ambient systems</li>
<li><strong>Paint Booth Ventilation</strong> — Downdraft, crossdraft, and semi-downdraft</li>
<li><strong>Heat Stress Mitigation</strong> — Spot cooling and air circulation</li>
<li><strong>Combustible Dust Control</strong> — NFPA 652/654 compliant systems</li>
<li><strong>Make-Up Air Systems</strong> — Heated and tempered replacement air</li>
<li><strong>Energy Recovery</strong> — Heat wheels, run-around loops, and ERVs</li>
</ul>`,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 7,
  },

  // ============================================================
  // 8. Custom Equipment Design
  // ============================================================
  {
    service_name: 'Custom Equipment Design',
    title: 'Custom Equipment Design & Build',
    subtitle: 'Purpose-Built Mechanical Equipment & Systems',
    layout_style: 'full_width',
    overview: `<p>When off-the-shelf equipment won't meet your process requirements, Tweet/Garot Mechanical's custom equipment design team delivers purpose-built solutions. Our engineers and fabricators collaborate to design, build, and install custom mechanical equipment that integrates seamlessly into your facility.</p>`,
    content: `<h3>Custom Equipment Capabilities</h3>
<ul>
<li><strong>Process Skids</strong> — Pre-assembled, pre-tested process equipment packages ready for plug-and-play installation</li>
<li><strong>Heat Exchangers</strong> — Custom shell-and-tube, plate-and-frame, and specialty heat transfer equipment</li>
<li><strong>Mixing & Blending Systems</strong> — Agitators, static mixers, and blending vessels</li>
<li><strong>Filtration Systems</strong> — Custom filter housings, bag filters, and strainer assemblies</li>
<li><strong>Pump Stations</strong> — Engineered pump packages with controls and instrumentation</li>
<li><strong>Pressure Vessels</strong> — ASME code vessels for air, water, chemical, and process applications</li>
<li><strong>Conveying Systems</strong> — Pneumatic conveying and material handling equipment</li>
</ul>
<h3>Design-Build Process</h3>
<p>Our integrated design-build process ensures that custom equipment meets your exact specifications. We handle concept development, detailed engineering, 3D modeling, fabrication, testing, delivery, and installation — all under one roof.</p>`,
    sidebar_content: null,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 8,
  },

  // ============================================================
  // 9. Engineering
  // ============================================================
  {
    service_name: 'Engineering',
    title: 'Mechanical Engineering Services',
    subtitle: 'In-House Engineering for Design-Build Excellence',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical's in-house engineering team provides comprehensive mechanical engineering services that bridge the gap between design intent and field execution. Our engineers bring real-world construction experience to the design process, resulting in systems that are not only technically sound but also practical and cost-effective to build.</p>
<p>Whether supporting a design-build project, providing value engineering on a bid-spec job, or developing solutions for an existing facility, our engineering team delivers innovative, constructable designs.</p>`,
    content: `<h3>Engineering Disciplines</h3>
<ul>
<li>HVAC system design and load calculations</li>
<li>Plumbing system design and sizing</li>
<li>Process piping engineering</li>
<li>Industrial ventilation design</li>
<li>Energy modeling and analysis</li>
<li>Controls system design and specification</li>
</ul>
<h3>Technology & Tools</h3>
<p>Our team uses industry-leading software including AutoCAD, Revit, Navisworks, Trane TRACE, and carrier HAP for design, coordination, and energy analysis.</p>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>Design-Build Engineering</strong> — Complete system design from concept through construction documents</li>
<li><strong>Value Engineering</strong> — Cost-saving alternatives without sacrificing performance</li>
<li><strong>Energy Audits</strong> — Facility assessments and energy reduction strategies</li>
<li><strong>Feasibility Studies</strong> — System options analysis with lifecycle cost comparison</li>
<li><strong>Commissioning Support</strong> — System start-up, testing, and performance verification</li>
<li><strong>3D/BIM Coordination</strong> — Clash detection and construction coordination</li>
<li><strong>Code Analysis</strong> — Building code and mechanical code compliance review</li>
<li><strong>As-Built Documentation</strong> — Record drawings and O&M manuals</li>
</ul>`,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 9,
  },

  // ============================================================
  // 10. Building Automation Systems
  // ============================================================
  {
    service_name: 'Building Automation Systems',
    title: 'Building Automation & Controls',
    subtitle: 'Intelligent Building Systems for Optimal Performance',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical designs, installs, and services building automation systems (BAS) that optimize comfort, energy efficiency, and operational visibility. Our controls team integrates HVAC, lighting, and other building systems into a unified platform that puts facility managers in control.</p>
<p>From standalone programmable controllers to enterprise-level building management systems, we deliver automation solutions that reduce operating costs and extend equipment life.</p>`,
    content: `<h3>Technology Platforms</h3>
<p>Our controls technicians are factory-trained on leading BAS platforms and can work with both open-protocol and proprietary systems. We specialize in BACnet, LonWorks, and Modbus communications for seamless integration across building systems.</p>
<h3>Energy Management</h3>
<ul>
<li>Demand-based ventilation (DCV)</li>
<li>Optimal start/stop scheduling</li>
<li>Automated demand response</li>
<li>Real-time energy dashboards and trending</li>
<li>Utility rate optimization</li>
</ul>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>New BAS Installation</strong> — Complete system design and installation</li>
<li><strong>System Upgrades</strong> — Legacy system modernization and migration</li>
<li><strong>Controls Integration</strong> — Connecting disparate systems to a single platform</li>
<li><strong>Remote Monitoring</strong> — 24/7 system monitoring and alarm management</li>
<li><strong>Sequence Programming</strong> — Custom control sequences for optimal performance</li>
<li><strong>Graphics & Dashboards</strong> — Intuitive operator interfaces and reporting</li>
<li><strong>Commissioning</strong> — Functional performance testing and system optimization</li>
<li><strong>Preventive Maintenance</strong> — Scheduled PM for controllers, sensors, and actuators</li>
</ul>`,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 10,
  },

  // ============================================================
  // 11. Air Purification
  // ============================================================
  {
    service_name: 'Air Purification',
    title: 'Air Purification & Filtration',
    subtitle: 'Clean Air Solutions for Healthier, Safer Environments',
    layout_style: 'full_width',
    overview: `<p>Tweet/Garot Mechanical designs and installs air purification and filtration systems that protect occupant health, maintain product integrity, and meet indoor air quality standards. Our solutions range from enhanced filtration upgrades to complete air purification systems using the latest technologies.</p>`,
    content: `<h3>Air Purification Technologies</h3>
<ul>
<li><strong>HEPA Filtration</strong> — 99.97% efficiency at 0.3 microns for healthcare, cleanroom, and critical environments</li>
<li><strong>UV-C Germicidal Systems</strong> — Upper-air, in-duct, and coil irradiation for pathogen reduction</li>
<li><strong>Bipolar Ionization</strong> — Needlepoint bipolar ionization (NPBI) for enhanced air quality</li>
<li><strong>Activated Carbon Filtration</strong> — VOC and odor removal for industrial and commercial applications</li>
<li><strong>Electronic Air Cleaners</strong> — High-efficiency particulate removal with low pressure drop</li>
<li><strong>Photocatalytic Oxidation (PCO)</strong> — Advanced oxidation for VOC and microbial control</li>
</ul>
<h3>Applications</h3>
<ul>
<li>Healthcare facilities and surgical suites</li>
<li>Cleanrooms and controlled environments</li>
<li>Schools and universities</li>
<li>Office buildings and corporate facilities</li>
<li>Food processing and packaging</li>
<li>Senior living and congregate care</li>
</ul>`,
    sidebar_content: null,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 11,
  },

  // ============================================================
  // 12. BIM
  // ============================================================
  {
    service_name: 'BIM',
    title: 'Building Information Modeling (BIM)',
    subtitle: '3D Coordination & Virtual Construction',
    layout_style: 'full_width',
    overview: `<p>Tweet/Garot Mechanical's BIM department provides advanced 3D modeling, coordination, and virtual construction services that improve project outcomes. Our dedicated BIM team uses Revit, Navisworks, and other industry-standard tools to create detailed mechanical models that drive prefabrication, eliminate field conflicts, and accelerate construction schedules.</p>`,
    content: `<h3>BIM Services</h3>
<ul>
<li><strong>3D Mechanical Modeling</strong> — Detailed LOD 300-400 models of HVAC, plumbing, and piping systems</li>
<li><strong>Clash Detection</strong> — Multi-trade coordination to identify and resolve conflicts before construction</li>
<li><strong>Prefabrication Drawings</strong> — Shop-ready spool drawings and fabrication packages generated from BIM</li>
<li><strong>Construction Sequencing</strong> — 4D scheduling to plan installation sequences and logistics</li>
<li><strong>As-Built Models</strong> — Updated models reflecting installed conditions for facility management</li>
<li><strong>Point Cloud Integration</strong> — Laser scanning and point cloud modeling for retrofit projects</li>
<li><strong>Quantity Takeoffs</strong> — Material quantities extracted directly from the model for accurate estimating</li>
</ul>
<h3>Prefabrication Integration</h3>
<p>Our BIM-to-fabrication workflow enables us to model piping spools, ductwork sections, and equipment assemblies in 3D, then produce fabrication drawings that go directly to our shop. This approach reduces field labor, minimizes waste, and improves quality through controlled shop fabrication.</p>`,
    sidebar_content: null,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 12,
  },

  // ============================================================
  // 13. Medical Gas
  // ============================================================
  {
    service_name: 'Medical Gas',
    title: 'Medical Gas Systems',
    subtitle: 'Life-Safety Piping Systems for Healthcare Facilities',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical provides complete medical gas piping system design, installation, and certification for hospitals, surgical centers, dental offices, and veterinary clinics. Our ASSE 6010 and 6020 certified medical gas installers and verifiers ensure every system meets NFPA 99 requirements and is ready for patient care.</p>
<p>Medical gas systems are life-safety systems. We bring the specialized training, quality procedures, and attention to detail these critical systems demand.</p>`,
    content: `<h3>Quality & Compliance</h3>
<ul>
<li>NFPA 99 Health Care Facilities Code compliance</li>
<li>ASSE 6010 certified installers</li>
<li>ASSE 6020 certified verifiers</li>
<li>Brazed joints per CGA and AWS standards</li>
<li>100% joint testing — nitrogen purge during brazing</li>
<li>Complete documentation and certification packages</li>
</ul>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>Oxygen Systems</strong> — Bulk supply, manifolds, and distribution piping</li>
<li><strong>Medical Air</strong> — Compressor systems and piping</li>
<li><strong>Medical Vacuum</strong> — Pump systems and distribution piping</li>
<li><strong>Nitrous Oxide</strong> — Supply systems and zone valve boxes</li>
<li><strong>Nitrogen</strong> — Surgical and instrument drive gas systems</li>
<li><strong>Carbon Dioxide</strong> — Insufflation gas piping</li>
<li><strong>WAGD Systems</strong> — Waste anesthetic gas disposal</li>
<li><strong>Zone Valve Boxes</strong> — Installation and labeling</li>
<li><strong>Outlet Installation</strong> — Console, ceiling column, and wall outlets</li>
<li><strong>System Verification</strong> — Complete testing and certification</li>
</ul>`,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 13,
  },

  // ============================================================
  // 14. Dust Collection
  // ============================================================
  {
    service_name: 'Dust Collection',
    title: 'Dust Collection Systems',
    subtitle: 'Engineered Dust Control for Worker Safety & Compliance',
    layout_style: 'two_column',
    overview: `<p>Tweet/Garot Mechanical designs, installs, and maintains dust collection systems that protect workers, ensure regulatory compliance, and reduce explosion risk in industrial facilities. Our systems are engineered to ACGIH and NFPA standards to effectively capture and control particulate from woodworking, metalworking, food processing, pharmaceutical, and other dust-generating operations.</p>`,
    content: `<h3>Engineering & Design</h3>
<p>Effective dust collection starts with proper engineering. We perform detailed assessments of dust sources, capture velocities, transport velocities, and filtration requirements to design systems that work — not just on paper, but in the real-world conditions of your facility.</p>
<h3>NFPA Compliance</h3>
<ul>
<li>NFPA 652 — Fundamentals of Combustible Dust</li>
<li>NFPA 654 — Prevention of Fire and Dust Explosions</li>
<li>NFPA 484 — Combustible Metals</li>
<li>NFPA 664 — Prevention of Fires in Wood Processing</li>
<li>Dust Hazard Analysis (DHA) support</li>
</ul>`,
    sidebar_content: `<h3>Service Offerings</h3>
<ul>
<li><strong>System Design</strong> — Complete engineering from source capture to exhaust</li>
<li><strong>Ductwork Installation</strong> — Spiral, welded, and flanged duct systems</li>
<li><strong>Collector Installation</strong> — Baghouse, cartridge, and cyclone collectors</li>
<li><strong>Hood Design</strong> — Custom capture hoods and enclosures</li>
<li><strong>Explosion Protection</strong> — Venting, suppression, and isolation systems</li>
<li><strong>System Upgrades</strong> — Capacity expansion and efficiency improvements</li>
<li><strong>Filter Changeout</strong> — Bag and cartridge replacement services</li>
<li><strong>System Balancing</strong> — Airflow measurement and damper adjustment</li>
</ul>`,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 14,
  },

  // ============================================================
  // 15. Mechanical Engineering
  // ============================================================
  {
    service_name: 'Mechanical Engineering',
    title: 'Mechanical Engineering',
    subtitle: 'Professional Engineering for Complex Mechanical Systems',
    layout_style: 'full_width',
    overview: `<p>Tweet/Garot Mechanical offers professional mechanical engineering services through our team of licensed Professional Engineers (PE). We provide stamped engineering drawings, energy analysis, code compliance review, and system design for complex mechanical projects that require the expertise and accountability of licensed engineering professionals.</p>`,
    content: `<h3>Engineering Services</h3>
<ul>
<li><strong>PE-Stamped Drawings</strong> — Signed and sealed mechanical engineering documents for permitting and construction</li>
<li><strong>HVAC System Design</strong> — Load calculations, equipment selection, and duct/pipe sizing</li>
<li><strong>Plumbing System Design</strong> — Domestic water, drainage, and specialty plumbing engineering</li>
<li><strong>Process Mechanical Design</strong> — Piping stress analysis, equipment specification, and P&ID development</li>
<li><strong>Energy Modeling</strong> — ASHRAE 90.1 compliance, energy code analysis, and lifecycle cost studies</li>
<li><strong>Commissioning</strong> — Commissioning plan development, functional testing, and system optimization</li>
<li><strong>Forensic Engineering</strong> — System failure analysis, root cause investigation, and remediation design</li>
<li><strong>Code Consulting</strong> — Mechanical code interpretation, variance requests, and compliance strategies</li>
</ul>
<h3>Collaborative Approach</h3>
<p>Our engineers work alongside our construction teams, bringing practical field knowledge to the design process. This collaboration produces designs that are constructable, maintainable, and cost-effective — eliminating the disconnect that often occurs between engineering firms and mechanical contractors.</p>`,
    sidebar_content: null,
    page2_content: null,
    footer_content: `<p style="text-align: center;"><strong>Green Bay</strong> &nbsp;|&nbsp; <strong>Milwaukee</strong> &nbsp;|&nbsp; <strong>Appleton</strong> &nbsp;|&nbsp; <strong>Madison</strong> &nbsp;|&nbsp; <strong>Wausau</strong></p>
<p style="text-align: center;">Contact us: (920) 494-2611 &nbsp;|&nbsp; info@tweetgarot.com</p>`,
    status: 'published',
    display_order: 15,
  },
];

async function seed() {
  console.log(`Seeding ${sellSheets.length} sell sheets for tenant ${TENANT_ID}...`);

  for (const ss of sellSheets) {
    const result = await pool.query(
      `INSERT INTO sell_sheets (
        tenant_id, service_name, title, subtitle, layout_style,
        overview, content, sidebar_content, page2_content, footer_content,
        status, display_order, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, service_name`,
      [
        TENANT_ID,
        ss.service_name,
        ss.title,
        ss.subtitle,
        ss.layout_style,
        ss.overview,
        ss.content,
        ss.sidebar_content,
        ss.page2_content,
        ss.footer_content,
        ss.status,
        ss.display_order,
        CREATED_BY,
      ]
    );
    console.log(`  ✅ ${result.rows[0].service_name} (id: ${result.rows[0].id})`);
  }

  console.log(`\nDone! ${sellSheets.length} sell sheets created.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
