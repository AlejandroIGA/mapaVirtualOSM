// components/OpenStreetMapComponent/OpenStreetMapComponent.jsx - Con ubicación manual
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./OpenStreetMapComponent.css";
import StaffModal from "../StaffModal/StaffModal";
import ManualLocationModal from "../ManualLocationModal/ManualLocationModal";
import { routeManager, loadPredefinedRoutes } from "../../utils/geoJsonRouteManager";
import {
  fetchBuildingsWithStaff,
  MAP_CONFIG,
  LOCATION_OPTIONS,
} from "../../data/buildingsData";
import {
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

const OpenStreetMapComponent = ({ selectedBuildingFromSearch, showManualLocationModal, onManualLocationModalClose, onCloseModal }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const buildingMarkersRef = useRef([]);
  const watchIdRef = useRef(null);
  const currentRouteRef = useRef(null);

  // Estados principales
  const [userLocation, setUserLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [error, setError] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);
  const [buildingsData, setBuildingsData] = useState([]);
  const [locationStatus, setLocationStatus] = useState({
    available: false,
    permission: null,
    checking: true,
  });

  // Estados para modales
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalBuilding, setStaffModalBuilding] = useState(null);

  // Estado interno para rutas
  const [routesLoaded, setRoutesLoaded] = useState(false);


  // Exponer para debugging y para el header
  useEffect(() => {
    window.routeManager = routeManager;
    window.routesLoaded = routesLoaded;

    // Exponer funciones de tracking para el header
    window.getTrackingStatus = () => ({
      isTracking,
      locationAvailable: locationStatus.available,
      userLocation
    });

    window.toggleLocationTracking = toggleTracking;

  }, [routesLoaded, isTracking, locationStatus.available, userLocation]);

  // Agregar event listener para clicks en el mapa (obtener coordenadas)
  useEffect(() => {
    if (mapInstance.current) {
      const handleMapClick = (e) => {
        const { lat, lng } = e.latlng;
        console.log(`📍 Coordenadas del clic: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

        // Mostrar popup temporal con las coordenadas
        const popup = L.popup()
          .setLatLng([lat, lng])
          .setContent(`
            <div style="text-align: center; font-family: sans-serif;">
              <strong>📍 Coordenadas:</strong><br>
              <span style="font-size: 12px; color: #666;">
                Lat: ${lat.toFixed(6)}<br>
                Lng: ${lng.toFixed(6)}
              </span><br>
              <button onclick="navigator.clipboard.writeText('${lat.toFixed(6)}, ${lng.toFixed(6)}'); this.textContent='¡Copiado!'" 
                      style="margin-top: 5px; padding: 4px 8px; background: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Copiar coordenadas
              </button>
            </div>
          `)
          .openOn(mapInstance.current);

        // Auto-cerrar el popup después de 3 segundos
        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.closePopup(popup);
          }
        }, 3000);
      };

      mapInstance.current.on('click', handleMapClick);

      return () => {
        if (mapInstance.current) {
          mapInstance.current.off('click', handleMapClick);
        }
      };
    }
  }, [isMapReady]);

  // Carga de rutas al inicializar
  useEffect(() => {
    const initializeRoutes = async () => {
      try {
        const success = await loadPredefinedRoutes();

        if (success) {
          setRoutesLoaded(true);

          if (mapInstance.current) {
            routeManager.displayRoutesOnMap(mapInstance.current, {
              color: '#FF6B35',
              weight: 3,
              opacity: 0.6,
              dashArray: '8, 4'
            });
          }
        }
      } catch (error) {
        setError(`Error cargando rutas: ${error.message}`);
      }
    };

    initializeRoutes();
  }, []);

  useEffect(() => {
    const loadBuildings = async () => {
      const buildings = await fetchBuildingsWithStaff();
      setBuildingsData(buildings);
    };

    loadBuildings();
  }, []);


  // Verificar estado de geolocalización
  useEffect(() => {
    const checkLocationAvailability = async () => {
      try {
        const status = await getLocationStatus();
        setLocationStatus({
          available: status.available,
          permission: status.permission,
          checking: false,
        });
      } catch (error) {
        setLocationStatus({
          available: false,
          permission: null,
          checking: false,
        });
      }
    };

    checkLocationAvailability();
  }, []);

  // Configurar funciones globales para popups
  useEffect(() => {
    if (buildingsData.length === 0) return;

    window.openStaffModalById = (buildingId) => {
      const building = buildingsData.find((b) => String(b.id) === String(buildingId));
      if (building) {
        setStaffModalBuilding(building);
        setStaffModalOpen(true);
      } else {
        alert("No se encontró información del edificio");
      }
    };

    window.getDirectionsOSM = async (buildingId, destLat, destLng) => {
      const building = buildingsData.find(b => String(b.id) === String(buildingId));
      if (building) {
        await handleGetDirections(building);
      }
    };

    window.handleLocationUpdate = (location) => {
      handleLocationUpdate(location);
    };

    window.openManualLocationModal = () => {
      if (onManualLocationModalClose) {
        onManualLocationModalClose();
      }
    };

    window.openImageModal = function (imageUrl) {
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

    return () => {
      delete window.openStaffModalById;
      delete window.getDirectionsOSM;
      delete window.handleLocationUpdate;
      delete window.openManualLocationModal;
      delete window.openImageModal;
      delete window.closeImageModal;
    };
  }, [buildingsData, onManualLocationModalClose]);


  // Manejar ubicación manual
  const handleManualLocationSet = async (location) => {
    console.log('📍 Ubicación manual establecida:', location);

    // Detener tracking GPS si está activo
    if (isTracking && watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
    }

    // Establecer la nueva ubicación
    handleLocationUpdate(location);

    // Centrar el mapa en la nueva ubicación
    if (mapInstance.current) {
      mapInstance.current.setView([location.lat, location.lng], 18);
    }

    // Mostrar mensaje de confirmación
    setError(null);
    const tempMessage = `✅ Ubicación manual establecida: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    setError(tempMessage);

    // Si hay un edificio seleccionado pendiente, calcular la ruta automáticamente
    if (selectedBuilding) {
      console.log('🗺️ Calculando ruta automáticamente para:', selectedBuilding.name);

      // Esperar un momento para que se actualice la ubicación
      setTimeout(async () => {
        try {
          await calculateRouteToBuilding(selectedBuilding, location);
        } catch (error) {
          console.error('Error calculando ruta automática:', error);
          setError(`Error calculando ruta: ${error.message}`);
        }
      }, 1000);
    }

    // Limpiar mensaje después de 3 segundos
    setTimeout(() => {
      if (!selectedBuilding) { // Solo limpiar si no hay ruta en proceso
        setError(null);
      }
    }, 3000);
  };

  // Funciones para crear rutas
  const createRouteFromGeoJSON = async (customRoute) => {
    const routeLine = L.polyline(customRoute.coordinates, {
      color: '#4285F4', // Azul para rutas calculadas dinámicamente
      weight: 4,
      opacity: 0.9,
      dashArray: null
    }).addTo(mapInstance.current);

    mapInstance.current.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

    const distanceKm = (customRoute.distance / 1000).toFixed(2);
    const durationMin = Math.round(customRoute.distance / 1000 * 12);

    return {
      distance: `${distanceKm} km`,
      duration: `${durationMin} min`,
      routeLine: routeLine,
      source: 'Rutas del campus (GeoJSON)',
      note: `Usando senderos del campus - ${customRoute.segments?.length || 0} segmentos`
    };
  };

  const calculateWithOpenRouteService = async (currentUserLocation, building) => {
    return await calculateAndShowDirections(
      mapInstance.current,
      { lat: currentUserLocation.lat, lng: currentUserLocation.lng },
      { lat: building.position.lat, lng: building.position.lng }
    );
  };

  useEffect(() => {
    if (isMapReady && mapInstance.current && buildingsData.length > 0) {
      createBuildingMarkers(mapInstance.current);
    }
  }, [isMapReady, buildingsData]);

  // Inicializar mapa
  useEffect(() => {
    const initializeMap = () => {
      try {
        const map = L.map(mapRef.current, {
          center: MAP_CONFIG.center,
          zoom: MAP_CONFIG.zoom,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          minZoom: 10,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 2
        }).addTo(map);

        mapInstance.current = map;
        setIsMapReady(true);

        //createBuildingMarkers(map);

      } catch (err) {
        setError(`Error inicializando mapa: ${err.message}`);
      }
    };

    if (mapRef.current && !mapInstance.current) {
      initializeMap();
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Mostrar rutas cuando el mapa esté listo
  useEffect(() => {
    if (mapInstance.current && routesLoaded) {
      routeManager.displayRoutesOnMap(mapInstance.current, {
        color: '#FF6B35',
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 4'
      });
    }
  }, [isMapReady, routesLoaded]);

  // Crear marcadores de edificios
  const createBuildingMarkers = (map) => {
    buildingMarkersRef.current = []; // Limpiar marcadores existentes

    buildingsData.forEach((building) => {
      const buildingIcon = L.icon({
        iconUrl: MackersImage,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([building.position.lat, building.position.lng], {
        icon: buildingIcon,
        title: building.name,
      }).addTo(map);

      marker.buildingId = building.id;

      const popupContent = createBuildingPopupContent(building);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      marker.on('click', () => {
        setSelectedBuilding(building);
      });

      buildingMarkersRef.current.push(marker);
    });

    // Marcar que los marcadores están listos
    setMarkersReady(true);
    console.log('Markers created:', buildingMarkersRef.current.length);
  };

  // Manejar actualización de ubicación
  const handleLocationUpdate = (location) => {
    setUserLocation(location);

    if (mapInstance.current) {
      if (userMarkerRef.current) {
        mapInstance.current.removeLayer(userMarkerRef.current);
      }

      if (accuracyCircleRef.current) {
        mapInstance.current.removeLayer(accuracyCircleRef.current);
      }

      userMarkerRef.current = createUserMarker(mapInstance.current, location, location.accuracy);

      if (location.accuracy) {
        accuracyCircleRef.current = createAccuracyCircle(mapInstance.current, location, location.accuracy);
      }
    }
  };

  // Toggle tracking - Función que será llamada desde el header
  const toggleTracking = async () => {
    if (isTracking) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
    } else {
      setError(null);

      try {
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

        if (mapInstance.current) {
          mapInstance.current.setView([location.lat, location.lng], 19);
        }

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
          },
          LOCATION_OPTIONS
        );

        watchIdRef.current = watchId;
        setIsTracking(true);

      } catch (err) {
        setError(`Error al iniciar seguimiento: ${err.message}`);
      }
    }
  };

  // Función auxiliar para calcular ruta a un edificio específico
  const calculateRouteToBuilding = async (building, currentUserLocation) => {
    const buildingName = building.name || `Edificio ${building.id}`;

    try {
      if (currentRouteRef.current) {
        mapInstance.current.removeLayer(currentRouteRef.current);
      }

      // Limpiar rutas calculadas anteriores (solo azules), mantener las predefinidas (moradas)
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline &&
          layer.options.color === '#4285F4' &&  // Solo eliminar rutas azules
          layer !== routeManager.routeLayer) {   // Mantener las rutas predefinidas
          mapInstance.current.removeLayer(layer);
        }
      });

      let result;

      // Intentar usar rutas GeoJSON primero
      if (routeManager.routeSegments.length > 0) {
        const customRoute = routeManager.calculateCustomRoute(
          currentUserLocation.lat,
          currentUserLocation.lng,
          building.position.lat,
          building.position.lng
        );

        if (customRoute) {
          result = await createRouteFromGeoJSON(customRoute);
        } else {
          result = await calculateWithOpenRouteService(currentUserLocation, building);
        }
      } else {
        result = await calculateWithOpenRouteService(currentUserLocation, building);
      }

      currentRouteRef.current = result.routeLine;

      const locationSource = currentUserLocation.manual ? " (ubicación manual)" : " (GPS)";
      const routeInfo =
        `🎯 Ruta a ${buildingName}\n\n` +
        `📏 Distancia: ${result.distance}\n` +
        `⏱️ Tiempo estimado: ${result.duration}\n` +
        `🚶‍♂️ Modo: Caminando\n` +
        `📍 Origen: Tu ubicación${locationSource}\n` +
        `🌐 Fuente: ${result.source}\n` +
        (result.note ? `📝 Nota: ${result.note}` : '');

      alert(routeInfo);

      // Limpiar edificio seleccionado después de calcular la ruta
      setSelectedBuilding(null);
      setError('✅ Ruta calculada exitosamente');

      setTimeout(() => {
        setError(null);
      }, 3000);

    } catch (err) {
      setSelectedBuilding(null);
      throw new Error(`Error calculando la ruta: ${err.message}`);
    }
  };

  // Manejar direcciones
  const handleGetDirections = async (building) => {
    const buildingName = building.name || `Edificio ${building.id}`;

    let currentUserLocation = userLocation;

    if (!currentUserLocation) {
      // Si no hay ubicación del usuario, sugerir usar ubicación manual
      const useManual = confirm(
        "No se ha establecido tu ubicación. ¿Quieres usar la ubicación manual para calcular la ruta?"
      );

      if (useManual) {
        // Guardar el edificio para calcular la ruta después de establecer la ubicación
        setSelectedBuilding(building);
        // Abrir el modal de ubicación manual directamente
        onManualLocationModalClose(); // Esta función abre el modal
        return;
      }

      // Intentar obtener ubicación GPS
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
            (error) => reject(error),
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 60000,
            }
          );
        });

        handleLocationUpdate(currentUserLocation);
      } catch (err) {
        alert("No se pudo obtener tu ubicación para calcular la ruta. Usa 'Ubicación Manual' en el header.");
        return;
      }
    }

    // Usar la función auxiliar para calcular la ruta
    try {
      await calculateRouteToBuilding(building, currentUserLocation);
    } catch (err) {
      alert(err.message);
    }
  };

  // Cleanup
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

  // UseEffect para enfocar edificio desde el buscador
  useEffect(() => {
    if (selectedBuildingFromSearch && mapInstance.current && markersReady) {
      console.log('Selected building from search:', selectedBuildingFromSearch);
      console.log('Markers available:', buildingMarkersRef.current.length);

      const { lat, lng } = selectedBuildingFromSearch.position;

      // Buscar el marcador correspondiente primero
      const marker = buildingMarkersRef.current.find(
        m => m.buildingId === selectedBuildingFromSearch.id
      );
      
      if (marker) {
        console.log('Found marker, opening popup for:', selectedBuildingFromSearch.name);

        // Centrar el mapa en el edificio
        mapInstance.current.setView([lat, lng], 18);

        // Esperar a que el mapa se centre y luego abrir el popup
        setTimeout(() => {
          try {
            marker.openPopup();
            setSelectedBuilding(selectedBuildingFromSearch);
            console.log('Popup opened successfully');
          
          } catch (error) {
            console.error('Error opening popup:', error);
          }
          
        }, 500);
        
      } else {
        console.warn('Marker not found for building:', selectedBuildingFromSearch);
        console.log('Available marker IDs:', buildingMarkersRef.current.map(m => m.buildingId));
      }
    }

  }, [selectedBuildingFromSearch, markersReady]);

  return (
    <div className="openstreetmap-container">
      {/* Error Display - Solo si hay error */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: error.includes('✅') ? '#e8f5e8' : '#ffebee',
          border: `1px solid ${error.includes('✅') ? '#4caf50' : '#f44336'}`,
          borderRadius: '4px',
          padding: '12px 20px',
          color: error.includes('✅') ? '#2e7d32' : '#c62828',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '80%'
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: error.includes('✅') ? '#2e7d32' : '#c62828',
              padding: '0',
              lineHeight: '1'
            }}
          >×</button>
        </div>
      )}

      {/* Solo el mapa */}
      <div ref={mapRef} className="map-container" style={{ height: '100%' }} />

      {/* StaffModal */}
      <StaffModal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        staff={staffModalBuilding?.staff || []}
        buildingName={staffModalBuilding?.name || ""}
      />

      {/* ManualLocationModal */}
      <ManualLocationModal
        isOpen={showManualLocationModal}
        onClose={onCloseModal || onManualLocationModalClose}
        onLocationSet={handleManualLocationSet}
        currentLocation={userLocation}
      />
    </div>
  );
};

export default OpenStreetMapComponent;