import React, { useState, useRef, useEffect } from 'react';
import { placesService, Place } from '../../services/places';
import './PlacesSearch.css';

interface PlacesSearchProps {
  onSelect: (place: Place) => void;
  placeholder?: string;
  near?: string;
}

const PlacesSearch: React.FC<PlacesSearchProps> = ({
  onSelect,
  placeholder = 'Search for a business...',
  near,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const places = await placesService.search(searchQuery, near);
      setResults(places);
      setShowDropdown(true);
    } catch (err: any) {
      console.error('Places search error:', err);
      setError(err.response?.data?.error || 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleSelect = (place: Place) => {
    onSelect(place);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="places-search" ref={containerRef}>
      <div className="places-search-input-wrapper">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="places-search-input"
        />
        {isLoading && <span className="loading-spinner" />}
      </div>

      {showDropdown && (
        <div className="places-dropdown">
          {error ? (
            <div className="places-error">{error}</div>
          ) : results.length === 0 ? (
            <div className="places-no-results">No businesses found</div>
          ) : (
            results.map((place) => (
              <div
                key={place.id}
                className="places-result"
                onClick={() => handleSelect(place)}
              >
                <div className="places-result-name">{place.name}</div>
                <div className="places-result-address">
                  {place.formatted_address || `${place.address}, ${place.city}, ${place.state} ${place.zip_code}`}
                </div>
                {place.phone && (
                  <div className="places-result-phone">{place.phone}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PlacesSearch;
