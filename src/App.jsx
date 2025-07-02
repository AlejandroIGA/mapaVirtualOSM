// App.jsx - Con funcionalidad de ubicación manual
import React, { useState } from 'react';
import './App.css';
import Header from './components/header/Header';
import SearchBar from './components/SearchBar/SearchBar';
import OpenStreetMapComponent from './components/OpenStreetMapComponent/OpenStreetMapComponent';

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null); // Estado compartido entre SearchBar y OpenStreetMap
  const [showManualLocationModal, setShowManualLocationModal] = useState(false); // Estado para el modal de ubicación manual

  // Función para abrir el modal de ubicación manual
  const handleManualLocationClick = () => {
    setShowManualLocationModal(true);
  };

  // Función para cerrar/abrir el modal de ubicación manual
  const handleManualLocationModalToggle = () => {
    setShowManualLocationModal(!showManualLocationModal);
  };

  // Función específica para cerrar el modal
  const handleCloseManualLocationModal = () => {
    setShowManualLocationModal(false);
  };

  return (
    <div className="app-container">
      <Header onManualLocationClick={handleManualLocationClick} />
      <SearchBar onSelectBuilding={setSelectedBuilding} />
      <main className="app-main">
        <OpenStreetMapComponent 
          selectedBuildingFromSearch={selectedBuilding}
          showManualLocationModal={showManualLocationModal}
          onManualLocationModalClose={handleManualLocationModalToggle}
          onCloseModal={handleCloseManualLocationModal}
        />
      </main>
    </div>
  );
}

export default App;