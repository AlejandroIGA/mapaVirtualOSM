// App.jsx
import React, { useState } from 'react';
import './App.css';
import Header from './components/header/Header';
import SearchBar from './components/SearchBar/SearchBar';
import OpenStreetMapComponent from './components/OpenStreetMapComponent/OpenStreetMapComponent';

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null); // Estado compartido entre SearchBar y OpenStreetMap

  return (
    <div className="app-container">
      <Header />
      <SearchBar onSelectBuilding={setSelectedBuilding} /> {/* pasa la función */}
      <main className="app-main">
        <OpenStreetMapComponent selectedBuildingFromSearch={selectedBuilding} /> {/*  pasa el dato */}
      </main>
    </div>
  );
}

export default App;
