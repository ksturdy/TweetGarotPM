import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import FloatingPalette from '../ui/FloatingPalette';
import { useUiStore } from '../../stores/useUiStore';
import { useToolStore } from '../../stores/useToolStore';
import { useAssemblyStore } from '../../stores/useAssemblyStore';
import AssemblyItemButton from './AssemblyItemButton';

export default function AssemblyPalette() {
  const open = useUiStore((s) => s.showAssemblyPalette);
  const onClose = useUiStore((s) => s.toggleAssemblyPalette);
  const setShowAssemblyEditor = useUiStore((s) => s.setShowAssemblyEditor);
  const assemblies = useAssemblyStore((s) => s.assemblies);
  const selectedAssembly = useToolStore((s) => s.selectedAssembly);
  const setPlaceableAssembly = useToolStore((s) => s.setPlaceableAssembly);

  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return assemblies;
    const q = search.toLowerCase();
    return assemblies.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [assemblies, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const cat = a.category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
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

  const allExpanded = grouped.size <= 5;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 6,
    border: '1px solid #1f3450',
    backgroundColor: '#0d1825',
    padding: '6px 10px',
    fontSize: 12,
    color: '#d4e3f3',
    outline: 'none',
  };

  return (
    <FloatingPalette
      title="Assemblies"
      open={open}
      onClose={onClose}
      defaultPosition={{ x: 280, y: 80 }}
      width={260}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assemblies..."
          style={inputStyle}
        />

        <button
          type="button"
          onClick={() => setShowAssemblyEditor(true)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 6,
            borderRadius: 6,
            border: '1px dashed #1f3450',
            backgroundColor: 'transparent',
            padding: '6px 10px',
            fontSize: 12,
            color: '#4a6a88',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          New Assembly
        </button>

        {assemblies.length === 0 ? (
          <p style={{ padding: '12px 4px', textAlign: 'center', fontSize: 12, color: '#4a6a88' }}>
            No assemblies yet. Select items on the canvas and save as assembly, or create one from scratch.
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: '8px 4px', textAlign: 'center', fontSize: 12, color: '#4a6a88' }}>
            No assemblies match &ldquo;{search}&rdquo;
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                      padding: '4px 4px',
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
                      {items.map((assembly) => (
                        <AssemblyItemButton
                          key={assembly.id}
                          assembly={assembly}
                          isSelected={selectedAssembly?.id === assembly.id}
                          onClick={() => setPlaceableAssembly(assembly)}
                        />
                      ))}
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
