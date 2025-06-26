// App.jsx
import React from 'react';
import './App.css';
import Header from './components/header/Header';
import SearchBar from './components/SearchBar/SearchBar';
import OpenStreetMapComponent from './components/OpenStreetMapComponent/OpenStreetMapComponent';

function App() {
  return (
    <div className="app-container">
        <Header></Header>
        <SearchBar></SearchBar>
      <main className="app-main">
        <OpenStreetMapComponent />
      </main>
    </div>
  );
}

export default App;