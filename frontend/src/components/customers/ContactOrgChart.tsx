import React, { useState, useRef, useEffect } from 'react';
import './ContactOrgChart.css';

export interface OrgChartPerson {
  id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  reports_to?: number | null;
  is_primary?: boolean;
}

interface OrgNode {
  contact: OrgChartPerson;
  children: OrgNode[];
  x: number;
  y: number;
  id: number;
}

interface ContactOrgChartProps {
  contacts: OrgChartPerson[];
  onContactEdit: (contact: OrgChartPerson) => void;
  layout?: 'vertical' | 'horizontal' | 'compact';
  showReportsCount?: boolean;
}

const ContactOrgChart: React.FC<ContactOrgChartProps> = ({ contacts, onContactEdit, layout = 'vertical', showReportsCount = true }) => {
  const [nodes, setNodes] = useState<Map<number, { x: number; y: number }>>(new Map());
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connectorStyle, setConnectorStyle] = useState<'curved' | 'orthogonal'>('curved');
  const hasDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // Keep refs in sync so the native wheel handler always reads current values
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Build tree structure from flat contact list
  const buildTree = (contacts: OrgChartPerson[]): OrgNode[] => {
    const map = new Map<number, OrgNode>();

    // Initialize all nodes with default positions
    contacts.forEach((contact, idx) => {
      map.set(contact.id, {
        contact,
        children: [],
        x: 0,
        y: 0,
        id: contact.id
      });
    });

    // Link children to parents
    const roots: OrgNode[] = [];
    contacts.forEach(contact => {
      const node = map.get(contact.id)!;
      if (contact.reports_to) {
        const parent = map.get(contact.reports_to);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = buildTree(contacts);

  // Calculate initial positions based on layout
  useEffect(() => {
    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 140;
    const H_SPACING = layout === 'compact' ? 80 : 150;
    const V_SPACING = layout === 'compact' ? 60 : 100;
    const PADDING = 100;

    const newPositions = new Map<number, { x: number; y: number }>();

    // Calculate positions for each node
    const calculatePositions = (node: OrgNode, depth: number, offsetX: number, offsetY: number): { width: number; height: number } => {
      let x = 0, y = 0;

      if (layout === 'horizontal') {
        // Horizontal: parent on left, children stack vertically on right
        x = depth * (CARD_WIDTH + H_SPACING);
        y = offsetY;
      } else {
        // Vertical/Compact: parent on top, children spread horizontally below
        x = offsetX;
        y = depth * (CARD_HEIGHT + V_SPACING);
      }

      newPositions.set(node.id, { x, y });

      if (node.children.length === 0) {
        return { width: CARD_WIDTH, height: CARD_HEIGHT };
      }

      // Calculate positions for all children
      let totalWidth = 0;
      let totalHeight = 0;
      const childSizes: Array<{ width: number; height: number }> = [];

      node.children.forEach((child) => {
        const childSize = calculatePositions(
          child,
          depth + 1,
          layout === 'horizontal' ? 0 : offsetX + totalWidth,
          layout === 'horizontal' ? offsetY + totalHeight : 0
        );
        childSizes.push(childSize);

        if (layout === 'horizontal') {
          totalHeight += childSize.height + V_SPACING;
        } else {
          totalWidth += childSize.width + H_SPACING;
        }
      });

      if (layout === 'horizontal') {
        totalHeight -= V_SPACING; // Remove last spacing

        // Center parent vertically among children
        const childrenMidpoint = (newPositions.get(node.children[0].id)!.y +
                                  newPositions.get(node.children[node.children.length - 1].id)!.y +
                                  CARD_HEIGHT) / 2;
        newPositions.set(node.id, { x, y: childrenMidpoint - CARD_HEIGHT / 2 });

        return { width: CARD_WIDTH, height: Math.max(CARD_HEIGHT, totalHeight) };
      } else {
        totalWidth -= H_SPACING; // Remove last spacing

        // Center parent horizontally above children
        const childrenMidpoint = (newPositions.get(node.children[0].id)!.x +
                                  newPositions.get(node.children[node.children.length - 1].id)!.x +
                                  CARD_WIDTH) / 2;
        newPositions.set(node.id, { x: childrenMidpoint - CARD_WIDTH / 2, y });

        return { width: Math.max(CARD_WIDTH, totalWidth), height: CARD_HEIGHT };
      }
    };

    // Position each root tree
    let currentOffset = 0;
    tree.forEach((root) => {
      const treeSize = calculatePositions(
        root,
        0,
        layout === 'horizontal' ? 0 : currentOffset,
        layout === 'horizontal' ? currentOffset : 0
      );

      if (layout === 'horizontal') {
        currentOffset += treeSize.height + V_SPACING * 2;
      } else {
        currentOffset += treeSize.width + H_SPACING * 2;
      }
    });

    // Normalize all positions to be positive (shift to start from PADDING)
    let globalMinX = Infinity;
    let globalMinY = Infinity;

    newPositions.forEach(pos => {
      globalMinX = Math.min(globalMinX, pos.x);
      globalMinY = Math.min(globalMinY, pos.y);
    });

    const offsetX = PADDING - globalMinX;
    const offsetY = PADDING - globalMinY;

    newPositions.forEach((pos, id) => {
      newPositions.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
    });

    setNodes(newPositions);
  }, [contacts, layout]);

  // Auto-fit when nodes change or layout changes
  useEffect(() => {
    if (nodes.size > 0) {
      setTimeout(() => handleFitToView(), 100);
    }
  }, [nodes.size, layout]);

  const handleMouseDown = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    const pos = nodes.get(nodeId);
    if (pos) {
      setDragging(nodeId);
      hasDragged.current = false; // Reset drag flag
      const rect = containerRef.current.getBoundingClientRect();
      // Calculate offset from mouse to card position in canvas space
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;
      setDragOffset({
        x: mouseX - pos.x,
        y: mouseY - pos.y
      });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Left-click or middle-click to pan
    if ((e.button === 0 || e.button === 1) && dragging === null) {
      if (e.button === 1) e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Mouse wheel to zoom, centered on cursor position (native listener for non-passive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 3);

      // Adjust pan so the point under the cursor stays fixed
      const newPan = {
        x: mouseX - (mouseX - currentPan.x) * (newZoom / currentZoom),
        y: mouseY - (mouseY - currentPan.y) * (newZoom / currentZoom)
      };

      // Update refs immediately for rapid successive events
      zoomRef.current = newZoom;
      panRef.current = newPan;

      setZoom(newZoom);
      setPan(newPan);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging !== null && containerRef.current) {
      hasDragged.current = true; // Mark that we've dragged
      const rect = containerRef.current.getBoundingClientRect();
      const newX = ((e.clientX - rect.left - pan.x) / zoom) - dragOffset.x;
      const newY = ((e.clientY - rect.top - pan.y) / zoom) - dragOffset.y;

      setNodes(prev => {
        const newMap = new Map(prev);
        newMap.set(dragging, { x: newX, y: newY });
        return newMap;
      });
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleCardClick = (contact: OrgChartPerson) => {
    // Only trigger edit if we didn't drag
    if (!hasDragged.current) {
      onContactEdit(contact);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleFitToView = () => {
    if (nodes.size === 0 || !containerRef.current) return;

    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 140;
    const PADDING = 100;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + CARD_WIDTH);
      maxY = Math.max(maxY, pos.y + CARD_HEIGHT);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const containerRect = containerRef.current.getBoundingClientRect();

    // Calculate zoom to fit
    const zoomX = (containerRect.width - PADDING * 2) / contentWidth;
    const zoomY = (containerRect.height - PADDING * 2) / contentHeight;
    const newZoom = Math.max(0.05, Math.min(zoomX, zoomY, 1)); // Clamp to [0.05, 1]

    // Center the content
    const newPan = {
      x: (containerRect.width - contentWidth * newZoom) / 2 - minX * newZoom,
      y: (containerRect.height - contentHeight * newZoom) / 2 - minY * newZoom
    };

    setZoom(newZoom);
    setPan(newPan);
  };

  // Calculate SVG dimensions
  const getSvgDimensions = () => {
    if (nodes.size === 0) return { width: 4000, height: 4000 };

    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 140;
    const PADDING = 1000;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + CARD_WIDTH);
      maxY = Math.max(maxY, pos.y + CARD_HEIGHT);
    });

    // SVG should be large enough to contain all nodes plus padding
    // Since nodes can have negative coordinates, we need to account for that
    const width = Math.max(4000, maxX - minX + PADDING * 2);
    const height = Math.max(4000, maxY - minY + PADDING * 2);

    return { width, height };
  };

  // Generate SVG connectors directly from contacts (avoids tree closure issues)
  const generateConnectors = () => {
    if (nodes.size === 0) return [];

    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 140;

    return contacts
      .filter(c => c.reports_to != null)
      .map(contact => {
        const childPos = nodes.get(contact.id);
        const parentPos = nodes.get(contact.reports_to!);
        if (!childPos || !parentPos) return null;

        const x1 = parentPos.x + CARD_WIDTH / 2;
        const y1 = parentPos.y + CARD_HEIGHT;
        const x2 = childPos.x + CARD_WIDTH / 2;
        const y2 = childPos.y;

        let path: string;
        if (connectorStyle === 'orthogonal') {
          const midY = (y1 + y2) / 2;
          path = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
        } else {
          const midY = (y1 + y2) / 2;
          path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        }

        return (
          <path
            key={`connector-${contact.reports_to}-${contact.id}`}
            d={path}
            stroke="#94a3b8"
            strokeWidth="2.5"
            fill="none"
            className="org-connector"
          />
        );
      })
      .filter((el): el is JSX.Element => el !== null);
  };

  const svgDims = getSvgDimensions();

  if (contacts.length === 0) {
    return (
      <div className="org-chart-empty">
        <p>No contacts found</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
      {/* Zoom Controls */}
      <div className="org-zoom-controls">
        <button onClick={handleZoomIn} title="Zoom In" className="org-zoom-btn">+</button>
        <button onClick={handleZoomOut} title="Zoom Out" className="org-zoom-btn">−</button>
        <button onClick={handleFitToView} title="Fit to View" className="org-zoom-btn org-zoom-fit">⊡</button>
        <button
          onClick={() => setConnectorStyle(connectorStyle === 'curved' ? 'orthogonal' : 'curved')}
          title={connectorStyle === 'curved' ? 'Switch to 90° connectors' : 'Switch to curved connectors'}
          className="org-zoom-btn"
          style={{ fontSize: '16px' }}
        >
          {connectorStyle === 'curved' ? '⌙' : '⤾'}
        </button>
        <div className="org-zoom-level">{Math.round(zoom * 100)}%</div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="org-chart-canvas"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onAuxClick={(e) => e.preventDefault()}
        style={{ cursor: isPanning ? 'grabbing' : dragging !== null ? 'default' : 'grab' }}
      >
        <div
          ref={canvasRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            width: `${svgDims.width}px`,
            height: `${svgDims.height}px`
          }}
        >
          {/* SVG Layer for connectors */}
          <svg
            className="org-connectors-layer"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${svgDims.width}px`,
              height: `${svgDims.height}px`,
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            {generateConnectors()}
          </svg>

          {/* Cards Layer */}
          {Array.from(nodes.entries()).map(([nodeId, position]) => {
            const contact = contacts.find(c => c.id === nodeId);
            if (!contact) return null;

            const node = findNode(tree, nodeId);
            if (!node) return null;

            return (
              <OrgCard
                key={nodeId}
                contact={contact}
                position={position}
                childCount={node.children.length}
                onMouseDown={(e) => handleMouseDown(e, nodeId)}
                onClick={handleCardClick}
                onEdit={onContactEdit}
                isDragging={dragging === nodeId}
                showReportsCount={showReportsCount}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper to find node in tree
const findNode = (tree: OrgNode[], nodeId: number): OrgNode | null => {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    const found = findNode(node.children, nodeId);
    if (found) return found;
  }
  return null;
};

interface OrgCardProps {
  contact: OrgChartPerson;
  position: { x: number; y: number };
  childCount: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (contact: OrgChartPerson) => void;
  onEdit: (contact: OrgChartPerson) => void;
  isDragging: boolean;
  showReportsCount?: boolean;
}

const OrgCard: React.FC<OrgCardProps> = ({ contact, position, childCount, onMouseDown, onClick, onEdit, isDragging, showReportsCount = true }) => {
  const initials = `${contact.first_name[0] || ''}${contact.last_name[0] || ''}`.toUpperCase();

  const getAvatarColor = (name: string) => {
    const colors = [
      '#4CAF50', '#2196F3', '#9C27B0', '#FF9800',
      '#F44336', '#009688', '#3F51B5', '#E91E63'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const avatarBg = getAvatarColor(contact.first_name + contact.last_name);

  return (
    <div
      className={`org-card ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={onMouseDown}
    >
      <div
        className="org-card-inner"
        onClick={(e) => { e.stopPropagation(); onClick(contact); }}
        onDoubleClick={(e) => { e.stopPropagation(); onEdit(contact); }}
      >
        <div className="org-card-header">
          <div className="org-avatar" style={{ backgroundColor: avatarBg }}>
            {initials}
          </div>
          <div className="org-card-info">
            <div className="org-name">
              {contact.first_name} {contact.last_name}
              {contact.is_primary && <span className="org-badge org-primary">★</span>}
            </div>
            {contact.title && <div className="org-title">{contact.title}</div>}
          </div>
        </div>
        <div className="org-card-details">
          {contact.email && <div className="org-email">📧 {contact.email}</div>}
          {contact.phone && <div className="org-phone">📞 {contact.phone}</div>}
        </div>
        {showReportsCount && childCount > 0 && (
          <div className="org-reports-count">
            {childCount} {childCount === 1 ? 'report' : 'reports'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactOrgChart;
