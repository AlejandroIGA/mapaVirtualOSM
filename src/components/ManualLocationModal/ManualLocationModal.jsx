// components/ManualLocationModal/ManualLocationModal.jsx
import React, { useState } from 'react';
import './ManualLocationModal.css';

const ManualLocationModal = ({ isOpen, onClose, onLocationSet, currentLocation }) => {
  const [latInput, setLatInput] = useState(currentLocation?.lat?.toString() || '');
  const [lngInput, setLngInput] = useState(currentLocation?.lng?.toString() || '');
  const [accuracy, setAccuracy] = useState('10');
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};

    // Validar latitud
    const lat = parseFloat(latInput);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      newErrors.lat = 'La latitud debe estar entre -90 y 90';
    }

    // Validar longitud
    const lng = parseFloat(lngInput);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      newErrors.lng = 'La longitud debe estar entre -180 y 180';
    }

    // Validar precisión
    const acc = parseFloat(accuracy);
    if (isNaN(acc) || acc <= 0) {
      newErrors.accuracy = 'La precisión debe ser un número positivo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateInputs()) {
      return;
    }

    const location = {
      lat: parseFloat(latInput),
      lng: parseFloat(lngInput),
      accuracy: parseFloat(accuracy),
      timestamp: Date.now(),
      manual: true // Marcar como ubicación manual
    };

    onLocationSet(location);
    onClose();
  };

  const handleReset = () => {
    setLatInput('');
    setLngInput('');
    setAccuracy('10');
    setErrors({});
  };

  const presetLocations = [
    {
      name: 'Campus UTEQ Centro',
      lat: 20.654832,
      lng: -100.403785
    },
    {
      name: 'Entrada Principal',
      lat: 20.653147,
      lng: -100.404025
    },
    {
      name: 'Biblioteca',
      lat: 20.654832,
      lng: -100.403785
    },
    {
      name: 'Rectoría',
      lat: 20.654324,
      lng: -100.405510
    }
  ];

  const handlePresetClick = (preset) => {
    setLatInput(preset.lat.toString());
    setLngInput(preset.lng.toString());
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="manual-location-overlay">
      <div className="manual-location-modal">
        <div className="modal-header">
          <h3>📍 Establecer Ubicación Manual</h3>
          <button 
            className="close-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="modal-content">
          <p className="modal-description">
            Ingresa las coordenadas manualmente para probar las rutas sin usar el GPS.
          </p>

          <form onSubmit={handleSubmit} className="location-form">
            <div className="input-group">
              <label htmlFor="latitude">Latitud:</label>
              <input
                id="latitude"
                type="number"
                step="any"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="Ej: 20.654832"
                className={errors.lat ? 'error' : ''}
              />
              {errors.lat && <span className="error-message">{errors.lat}</span>}
            </div>

            <div className="input-group">
              <label htmlFor="longitude">Longitud:</label>
              <input
                id="longitude"
                type="number"
                step="any"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="Ej: -100.403785"
                className={errors.lng ? 'error' : ''}
              />
              {errors.lng && <span className="error-message">{errors.lng}</span>}
            </div>

            <div className="input-group">
              <label htmlFor="accuracy">Precisión (metros):</label>
              <input
                id="accuracy"
                type="number"
                step="1"
                min="1"
                value={accuracy}
                onChange={(e) => setAccuracy(e.target.value)}
                placeholder="10"
                className={errors.accuracy ? 'error' : ''}
              />
              {errors.accuracy && <span className="error-message">{errors.accuracy}</span>}
            </div>

            <div className="preset-locations">
              <label>Ubicaciones predefinidas:</label>
              <div className="preset-buttons">
                {presetLocations.map((preset, index) => (
                  <button
                    key={index}
                    type="button"
                    className="preset-button"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="reset-button"
                onClick={handleReset}
              >
                Limpiar
              </button>
              <button 
                type="submit" 
                className="submit-button"
              >
                Establecer Ubicación
              </button>
            </div>
          </form>

          <div className="coordinates-info">
            <small>
              💡 <strong>Tip:</strong> Puedes hacer clic derecho en el mapa para obtener coordenadas, 
              o usar las ubicaciones predefinidas del campus.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualLocationModal;