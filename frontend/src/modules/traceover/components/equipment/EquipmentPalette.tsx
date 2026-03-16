import { useState, useMemo } from 'react';
import FloatingPalette from '../ui/FloatingPalette';
import { useUiStore } from '../../stores/useUiStore';
import { useToolStore } from '../../stores/useToolStore';
import { EQUIPMENT_CATALOG } from '../../data/equipmentCatalog';
import type { PlaceableItemDef } from '../../types/placeableItem';

const shapeStyle = (item: PlaceableItemDef): React.CSSProperties => ({
  width: 20,
  height: 20,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 8,
  fontWeight: 700,
  color: '#fff',
  backgroundColor: item.color,
  borderRadius: item.shape === 'circle' ? '50%' : 3,
});

export default function EquipmentPalette() {
  const open = useUiStore((s) => s.showEquipmentPalette);
  const onClose = useUiStore((s) => s.toggleEquipmentPalette);
  const selectedItem = useToolStore((s) => s.selectedPlaceableItem);
  const setPlaceableItem = useToolStore((s) => s.setPlaceableItem);

  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return EQUIPMENT_CATALOG;
    const q = search.toLowerCase();
    return EQUIPMENT_CATALOG.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.abbreviation.toLowerCase().includes(q) ||
        item.subcategory.toLowerCase().includes(q),
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlaceableItemDef[]>();
    for (const item of filtered) {
      const cat = item.subcategory || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const allExpanded = grouped.size <= 8;

  return (
    <FloatingPalette
      title="Equipment"
      open={open}
      onClose={onClose}
      defaultPosition={{ x: 280, y: 80 }}
      width={240}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment..."
          style={{
            width: '100%',
            borderRadius: 6,
            border: '1px solid #1f3450',
            backgroundColor: '#0d1825',
            padding: '6px 10px',
            fontSize: 12,
            color: '#d4e3f3',
            outline: 'none',
          }}
        />

        {filtered.length === 0 ? (
          <p style={{ padding: '8px 4px', textAlign: 'center', fontSize: 12, color: '#4a6a88' }}>
            No items match &ldquo;{search}&rdquo;
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...grouped.entries()].map(([cat, items]) => {
              const isExpanded = allExpanded || expandedCategories.has(cat);
              return (
                <div key={cat}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 2px',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#4a6a88',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 8 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    {cat}
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 400 }}>({items.length})</span>
                  </button>

                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 4 }}>
                      {items.map((item) => {
                        const isSelected = selectedItem?.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPlaceableItem(item)}
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'center',
                              gap: 8,
                              padding: '4px 6px',
                              borderRadius: 4,
                              border: 'none',
                              backgroundColor: isSelected ? '#1e3a5f' : 'transparent',
                              cursor: 'pointer',
                              color: '#d4e3f3',
                            }}
                          >
                            <div style={shapeStyle(item)}>
                              <span style={{ fontSize: 7 }}>{item.abbreviation.slice(0, 2)}</span>
                            </div>
                            <span style={{ fontSize: 12 }}>{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FloatingPalette>
  );
}
