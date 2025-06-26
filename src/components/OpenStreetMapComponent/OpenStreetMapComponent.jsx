// components/OpenStreetMapComponent.jsx
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./OpenStreetMapComponent.css";
import StaffModal from "../StaffModal/StaffModal"; // ✅ IMPORTAR StaffModal
import {
  BUILDINGS_DATA,
  MAP_CONFIG,
  LOCATION_OPTIONS,
} from "../../data/buildingsData";
import {
  getCurrentUserLocation,
  startLocationTracking,
  stopLocationTracking,
  getLocationStatus,
} from "../../utils/locationUtils";
import {
  createBuildingPopupContent,
  createUserMarker,
  createAccuracyCircle,
  calculateAndShowDirections,
} from "../../utils/osmMapUtils";

// Importar iconos
import MackersImage from "../../assets/Macker_1.png";

const OpenStreetMapComponent = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const buildingMarkersRef = useRef([]);
  const watchIdRef = useRef(null);
  const currentRouteRef = useRef(null); // Para manejar rutas

  // Estados
  const [userLocation, setUserLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [error, setError] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationStatus, setLocationStatus] = useState({
    available: false,
    permission: null,
    checking: true,
  });

  // ✅ Estados para StaffModal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalBuilding, setStaffModalBuilding] = useState(null);

  // Verificar estado de geolocalización al cargar
  useEffect(() => {
    const checkLocationAvailability = async () => {
      try {
        const status = await getLocationStatus();
        setLocationStatus({
          available: status.available,
          permission: status.permission,
          checking: false,
        });
        console.log("📍 Estado de geolocalización:", status);
      } catch (error) {
        console.error("Error verificando geolocalización:", error);
        setLocationStatus({
          available: false,
          permission: null,
          checking: false,
        });
      }
    };

    checkLocationAvailability();
  }, []);

  // ✅ Configurar funciones globales para popups
  useEffect(() => {
    // Función global para abrir StaffModal
    window.openStaffModalById = (buildingId) => {
      console.log("🔍 Abriendo modal para edificio ID:", buildingId);
      const building = BUILDINGS_DATA.find((b) => String(b.id) === String(buildingId));
      
      if (building) {
        setStaffModalBuilding(building);
        setStaffModalOpen(true);
        console.log("✅ Modal abierto para:", building.name);
      } else {
        console.warn("⚠️ Edificio no encontrado:", buildingId);
        alert("No se encontró información del edificio");
      }
    };

    // Función global para direcciones
    window.getDirectionsOSM = async (buildingId, destLat, destLng) => {
      console.log("🗺️ Solicitando direcciones para edificio:", buildingId);
      await handleGetDirections({ id: buildingId, position: { lat: destLat, lng: destLng } });
    };

    // Función global para modal de imágenes
    window.openImageModal = function (imageUrl) {
      console.log("🖼️ Abriendo modal de imagen:", imageUrl);
      const modalHtml = `
        <div id="image-modal-overlay" style="
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background-color: rgba(0,0,0,0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          cursor: pointer;
        " onclick="window.closeImageModal()">
          <img src="${imageUrl}" alt="Imagen ampliada" style="
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 0 20px #000;
            cursor: default;
          " onclick="event.stopPropagation()" />
          <button onclick="window.closeImageModal()" style="
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 20px;
            cursor: pointer;
            z-index: 10001;
          ">×</button>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    window.closeImageModal = function () {
      const modal = document.getElementById('image-modal-overlay');
      if (modal) modal.remove();
    };

    // Cleanup
    return () => {
      delete window.openStaffModalById;
      delete window.getDirectionsOSM;
      delete window.openImageModal;
      delete window.closeImageModal;
    };
  }, []);

  // Inicializar mapa
  useEffect(() => {
    const initializeMap = () => {
      try {
        console.log("🗺️ Inicializando mapa OpenStreetMap...");

        // Crear mapa
        const map = L.map(mapRef.current, {
          center: MAP_CONFIG.center,
          zoom: MAP_CONFIG.zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // ✅ Agregar capa de tiles OSM específicamente
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          minZoom: 10,
          // Configuraciones adicionales para mejor rendimiento
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 2
        }).addTo(map);

        mapInstance.current = map;
        setIsMapReady(true);

        // Crear marcadores de edificios
        createBuildingMarkers(map);

        console.log("✅ Mapa OpenStreetMap con tiles OSM inicializado correctamente");
      } catch (err) {
        console.error("❌ Error inicializando mapa:", err);
        setError(`Error inicializando mapa: ${err.message}`);
      }
    };

    if (mapRef.current && !mapInstance.current) {
      initializeMap();
    }

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Crear marcadores de edificios
  const createBuildingMarkers = (map) => {
    console.log("🏢 Creando marcadores de edificios...");

    BUILDINGS_DATA.forEach((building) => {
      // Crear icono personalizado
      const buildingIcon = L.icon({
        iconUrl: MackersImage,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      // Crear marcador
      const marker = L.marker([building.position.lat, building.position.lng], {
        icon: buildingIcon,
        title: building.name,
      }).addTo(map);

      // Crear popup con contenido
      const popupContent = createBuildingPopupContent(building);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      // Evento click
      marker.on('click', () => {
        console.log("🏢 Click en edificio:", building.name);
        setSelectedBuilding(building);
      });

      buildingMarkersRef.current.push(marker);
    });

    console.log(`✅ ${BUILDINGS_DATA.length} marcadores creados`);
  };

  // Manejar actualización de ubicación
  const handleLocationUpdate = (location) => {
    console.log("📍 Actualizando ubicación:", location);
    setUserLocation(location);

    if (mapInstance.current) {
      // Remover marcador anterior
      if (userMarkerRef.current) {
        mapInstance.current.removeLayer(userMarkerRef.current);
      }

      // Remover círculo anterior
      if (accuracyCircleRef.current) {
        mapInstance.current.removeLayer(accuracyCircleRef.current);
      }

      // Crear nuevo marcador de usuario
      userMarkerRef.current = createUserMarker(mapInstance.current, location, location.accuracy);

      // Crear círculo de precisión
      if (location.accuracy) {
        accuracyCircleRef.current = createAccuracyCircle(mapInstance.current, location, location.accuracy);
      }
    }
  };

  // Toggle tracking
  const toggleTracking = async () => {
    if (isTracking) {
      // Detener tracking
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      console.log("🛑 Seguimiento detenido");
    } else {
      // Iniciar tracking
      setError(null);
      
      try {
        console.log("🎯 Iniciando seguimiento...");

        // Obtener ubicación inicial
        const location = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              });
            },
            (error) => {
              const messages = {
                1: "Permisos de ubicación denegados",
                2: "Ubicación no disponible",
                3: "Tiempo de espera agotado",
              };
              reject(new Error(messages[error.code] || "Error desconocido"));
            },
            LOCATION_OPTIONS
          );
        });

        handleLocationUpdate(location);

        // Centrar mapa en ubicación
        if (mapInstance.current) {
          mapInstance.current.setView([location.lat, location.lng], 19);
        }

        // Iniciar seguimiento continuo
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            };
            handleLocationUpdate(newLocation);
          },
          (error) => {
            console.error("Error en seguimiento:", error);
            // No detener el tracking por errores menores
          },
          LOCATION_OPTIONS
        );

        watchIdRef.current = watchId;
        setIsTracking(true);
        console.log("✅ Seguimiento iniciado");

      } catch (err) {
        console.error("❌ Error al iniciar seguimiento:", err);
        setError(`Error al iniciar seguimiento: ${err.message}`);
      }
    }
  };

  // ✅ Manejar direcciones con OpenRouteService
  const handleGetDirections = async (building) => {
    const buildingName = building.name || `Edificio ${building.id}`;
    console.log("🗺️ Solicitando direcciones para:", buildingName);

    let currentUserLocation = userLocation;

    // Si no tenemos ubicación, intentar obtenerla
    if (!currentUserLocation) {
      console.log("🔄 Obteniendo ubicación actual para direcciones...");
      
      try {
        currentUserLocation = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              };
              resolve(location);
            },
            (error) => {
              reject(error);
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 60000,
            }
          );
        });

        handleLocationUpdate(currentUserLocation);
        console.log("✅ Ubicación obtenida para direcciones");

      } catch (err) {
        console.error("❌ No se pudo obtener ubicación:", err);
        
        let errorMessage = "No se pudo obtener tu ubicación para calcular la ruta.";
        
        if (err.code === 1) {
          errorMessage = "Permisos de ubicación denegados.\n\nPara obtener direcciones, permite el acceso a la ubicación en tu navegador.";
        } else if (err.code === 2) {
          errorMessage = "No se pudo determinar tu ubicación.\n\nVerifica que tengas GPS activado.";
        } else if (err.code === 3) {
          errorMessage = "La búsqueda de ubicación tardó demasiado.\n\nInténtalo de nuevo.";
        }

        alert(errorMessage);
        return;
      }
    }

    // Calcular direcciones con OpenRouteService
    try {
      console.log("🧮 Calculando ruta con OpenRouteService...");

      // Limpiar rutas anteriores
      if (currentRouteRef.current) {
        mapInstance.current.removeLayer(currentRouteRef.current);
      }

      const result = await calculateAndShowDirections(
        mapInstance.current,
        { lat: currentUserLocation.lat, lng: currentUserLocation.lng },
        { lat: building.position.lat, lng: building.position.lng }
      );

      // Guardar referencia de la ruta para limpiarla después
      currentRouteRef.current = result.routeLine;

      // Mostrar información de la ruta
      const routeInfo = 
        `🎯 Ruta a ${buildingName}\n\n` +
        `📏 Distancia: ${result.distance}\n` +
        `⏱️ Tiempo estimado: ${result.duration}\n` +
        `🚶‍♂️ Modo: Caminando\n` +
        `🌐 Fuente: ${result.source}` +
        (result.note ? `\n📝 ${result.note}` : '');

      alert(routeInfo);
      console.log("✅ Ruta calculada exitosamente");

    } catch (err) {
      console.error("❌ Error calculando ruta:", err);
      alert(`Error calculando la ruta: ${err.message}\n\nVerifica tu conexión a internet e inténtalo de nuevo.`);
    }
  };

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (err) {
          console.error("Error en cleanup:", err);
        }
      }
    };
  }, []);

  return (
    <div className="openstreetmap-container">
      {/* Error Display */}
      {error && (
        <div className="error-display">
          <div>
            <strong>⚠️ Error:</strong> {error}
          </div>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Panel de controles */}
      <div className="controls-section">
        <div className="controls-header">
          <h2 className="main-title">Sistema de Navegación UTEQ - OpenStreetMap</h2>
          <div>
            <button
              onClick={toggleTracking}
              className={`button-base tracking-button ${isTracking ? "active" : "inactive"}`}
              disabled={!locationStatus.available}
            >
              {isTracking ? "🛑 Detener Seguimiento" : "🎯 Iniciar Seguimiento"}
            </button>
          </div>
        </div>

        <p className="description-text">
          {userLocation
            ? `📍 Ubicación detectada (±${Math.round(userLocation.accuracy)}m) - Haz clic en un edificio para obtener direcciones`
            : "📍 Haz clic en 'Iniciar Seguimiento' para detectar tu ubicación y calcular rutas"}
        </p>

        <div className="status-grid">
          <div className="status-item">
            <div className={`status-dot ${isMapReady ? "ready" : "inactive"}`}></div>
            <span>Mapa: {isMapReady ? "Listo" : "Cargando..."}</span>
          </div>
          <div className="status-item">
            <div className={`status-dot ${locationStatus.available ? "ready" : "error"}`}></div>
            <span>GPS: {locationStatus.available ? "Disponible" : "No disponible"}</span>
          </div>
          <div className="status-item">
            <div className={`status-dot ${isTracking ? "ready" : "inactive"}`}></div>
            <span>Seguimiento: {isTracking ? "Activo" : "Inactivo"}</span>
          </div>
          <div className="status-item">
            <div className={`status-dot ${userLocation ? "ready" : "warning"}`}></div>
            <span>Ubicación: {userLocation ? "Detectada" : "Sin detectar"}</span>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <div ref={mapRef} className="map-container" />

      {/* ✅ StaffModal */}
      <StaffModal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        staff={staffModalBuilding?.staff || []}
        buildingName={staffModalBuilding?.name || ""}
      />
    </div>
  );
};

export default OpenStreetMapComponent;