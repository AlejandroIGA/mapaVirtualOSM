// components/SearchBar.jsx
import { useState, useEffect } from 'react';
import './SearchBar.css';
import { fetchBuildings,fetchAllStaff } from '../../data/buildingsData';


const normalizeText = (text) =>
  (text || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SearchBar = ({ onSelectBuilding }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [buildings, setBuildings] = useState([]);
  const [staffList, setStaffList] = useState([]); // ✅ lista de personal
  const [searchType, setSearchType] = useState('building'); // 'building' o 'staff'

  // Cargar edificios al inicio
  useEffect(() => {
    const loadBuildings = async () => {
      const data = await fetchBuildings();
      setBuildings(data);
    };
    loadBuildings();
  }, []);

  // Cargar personal solo si se selecciona "Buscar personal"
  useEffect(() => {
    setSearchTerm('');
    setResults([]);

    if (searchType === 'staff' && staffList.length === 0) {
      const loadStaff = async () => {
        const data = await fetchAllStaff(); // ✅ aquí se carga TODO el personal
        setStaffList(data);
      };
      loadStaff();
    }
  }, [searchType]);

  // Filtrar resultados al escribir
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setResults([]);
      return;
    }

    const normalizedTerm = normalizeText(searchTerm);
    let filteredResults = [];

    if (searchType === 'building') {
      filteredResults = buildings.filter(building =>
        normalizeText(building.name).includes(normalizedTerm)
      );
    } else if (searchType === 'staff') {
      staffList.forEach(person => {
        if (normalizeText(person.name).includes(normalizedTerm)) {
          const building = buildings.find(b => b.name === person.buildingName);
          if (building) {
            filteredResults.push({
              building,
              staff: person
            });
          }
        }
      });
    }

    setResults(filteredResults);
  }, [searchTerm, buildings, staffList, searchType]);

  const handleSuggestionClick = (item) => {
    if (searchType === 'building') {
      setSearchTerm(item.name);
      onSelectBuilding?.(item);
    } else if (searchType === 'staff') {
      setSearchTerm(item.staff.name);
      onSelectBuilding?.(item.building);
    }
    setIsFocused(false);
  };

  return (
    <div className="search-bar">
      <div className="search-options">
        <label>
          <input
            type="checkbox"
            value="building"
            checked={searchType === 'building'}
            onChange={() => setSearchType('building')}
          />
          Buscar edificio 🏪
        </label>
        <label>
          <input
            type="checkbox"
            value="staff"
            checked={searchType === 'staff'}
            onChange={() => setSearchType('staff')}
          />
          Buscar personal 👥
        </label>
      </div>

      <div className="search-bar-container">
        <input
          type="text"
          className="search-input"
          placeholder={
            searchType === 'building'
              ? 'Buscar edificio...'
              : 'Buscar personal...'
          }
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
          {results.slice(0, 5).map((item, index) => (
            <div
              key={index}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(item)}
            >
              {searchType === 'building'
                ? item.name
                : `${item.staff.name} (${item.building.name})`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
