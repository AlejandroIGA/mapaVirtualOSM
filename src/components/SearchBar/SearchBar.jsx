// SearchBar.jsx
import { useState, useEffect } from 'react';
import './SearchBar.css';
import { BUILDINGS_DATA } from '../../data/buildingsData';

const normalizeText = (text) =>
  (text || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SearchBar = ({ onSelectBuilding }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setResults([]);
      return;
    }

    const normalizedTerm = normalizeText(searchTerm);

    const filteredResults = BUILDINGS_DATA.filter(building => {
      const nameMatch = normalizeText(building.name).includes(normalizedTerm);
      return nameMatch;
    });

    setResults(filteredResults);
  }, [searchTerm]);

  const handleSuggestionClick = (building) => {
    setSearchTerm(building.name);
    onSelectBuilding?.(building); // Llama a la función del padre
    setIsFocused(false);
  };

  return (
    <div className="search-bar">
      <div className="search-bar-container">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar edificio o persona..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
        <span className="search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm6.32-1.63a9 9 0 111.41-1.41l3.59 3.59a1 1 0 01-1.41 1.41l-3.59-3.59z" />
          </svg>
        </span>
      </div>

      {isFocused && searchTerm && results.length > 0 && (
        <div className="search-suggestions">
          {results.slice(0, 5).map(building => (
            <div
              key={building.id}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(building)}
            >
              {building.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;