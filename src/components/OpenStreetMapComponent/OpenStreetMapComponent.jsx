// components/OpenStreetMapComponent/OpenStreetMapComponent.jsx - Sin ubicación manual
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./OpenStreetMapComponent.css";
import StaffModal from "../StaffModal/StaffModal";

// IMPORTAR SISTEMA DE NODOS (ÚNICO para cálculo de rutas)
import {
  nodeManager,
  initializeNodeNetwork,
} from "../../utils/nodeNetworkManager";
// GeoJSON SOLO para visualización de senderos (NO para rutas)
import {
  routeManager,
  loadPredefinedRoutes,
} from "../../utils/geoJsonRouteManager";

import {
  fetchBuildings,
  fetchStaffByBuildingName,
  MAP_CONFIG,
  LOCATION_OPTIONS,
} from "../../data/buildingsData";
import { getLocationStatus } from "../../utils/locationUtils";
import {
  createBuildingPopupContent,
  createUserMarker,
  createAccuracyCircle,
  calculateAndShowDirections,
} from "../../utils/osmMapUtils";

// Importar iconos
import MackersImage from "../../assets/Macker_1.png";

const OpenStreetMapComponent = ({
  selectedBuildingFromSearch
}) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const buildingMarkersRef = useRef([]);
  const watchIdRef = useRef(null);
  const currentRouteRef = useRef(null);
  
  // Referencias para mantener estado actualizado
  const userLocationRef = useRef(null);
  const isTrackingRef = useRef(false);

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

  // Estados para los sistemas de rutas
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [nodesLoaded, setNodesLoaded] = useState(false);
  const [showDebugNodes, setShowDebugNodes] = useState(false);

  // Exponer para debugging y para el header
  useEffect(() => {
    window.routeManager = routeManager;
    window.nodeManager = nodeManager;
    window.routesLoaded = routesLoaded;
    window.nodesLoaded = nodesLoaded;

    // Funciones de debug
    window.toggleDebugNodes = () => {
      const newState = !showDebugNodes;
      setShowDebugNodes(newState);
      if (mapInstance.current) {
        nodeManager.showDebugNodes(mapInstance.current, newState);
        if (newState) {
          nodeManager.showDebugConnections(mapInstance.current, true);
        }
      }
    };

    // Exponer funciones de tracking para el header
    window.getTrackingStatus = () => ({
      isTracking,
      locationAvailable: locationStatus.available,
      userLocation,
    });

    window.toggleLocationTracking = toggleTracking;
  }, [
    routesLoaded,
    nodesLoaded,
    isTracking,
    locationStatus.available,
    userLocation,
    showDebugNodes,
  ]);

  // Carga de sistemas al inicializar
  useEffect(() => {
    const initializeSystems = async () => {
      try {
        // Cargar senderos GeoJSON SOLO para visualización (NO para rutas)
        const routesSuccess = await loadPredefinedRoutes();
        if (routesSuccess) {
          setRoutesLoaded(true);
          console.log("🎨 Senderos GeoJSON cargados SOLO para visualización");
        }

        // Cargar red de nodos para cálculo de rutas (SISTEMA PRINCIPAL)
        const nodesSuccess = await initializeNodeNetwork();
        if (nodesSuccess) {
          setNodesLoaded(true);
          console.log("🎯 Red de nodos cargada para cálculo de rutas");
        }

        if (!nodesSuccess) {
          setError(
            "⚠️ Sistema de nodos no disponible. Solo se usará OpenRouteService como respaldo."
          );
        }
      } catch (error) {
        setError(`Error inicializando sistemas: ${error.message}`);
      }
    };

    initializeSystems();
  }, []);

  // Agregar event listener para clicks en el mapa (obtener coordenadas)
  useEffect(() => {
    if (mapInstance.current) {
      const handleMapClick = (e) => {
        const { lat, lng } = e.latlng;
        console.log(
          `📍 Coordenadas del clic: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        );

        // Encontrar nodo más cercano si los nodos están cargados
        let nearestNodeInfo = "";
        if (nodesLoaded) {
          const nearestNode = nodeManager.findNearestNode(lat, lng, 100);
          if (nearestNode) {
            nearestNodeInfo = `<br><small style="color: #666;">Nodo más cercano: ${nearestNode.name
              } (${nearestNode.distance.toFixed(1)}m)</small>`;
          }
        }

        // Mostrar popup temporal con las coordenadas
        const popup = L.popup()
          .setLatLng([lat, lng])
          .setContent(
            `
            <div style="text-align: center; font-family: sans-serif;">
              <strong>📍 Coordenadas:</strong><br>
              <span style="font-size: 12px; color: #666;">
                Lat: ${lat.toFixed(6)}<br>
                Lng: ${lng.toFixed(6)}
              </span>
              ${nearestNodeInfo}
              <br>
              <button onclick="navigator.clipboard.writeText('${lat.toFixed(
              6
            )}, ${lng.toFixed(6)}'); this.textContent='¡Copiado!'"
                style="margin-top: 5px; padding: 4px 8px; background: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Copiar coordenadas
              </button>
            </div>
          `
          )
          .openOn(mapInstance.current);

        // Auto-cerrar el popup después de 4 segundos
        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.closePopup(popup);
          }
        }, 4000);
      };

      mapInstance.current.on("click", handleMapClick);

      return () => {
        if (mapInstance.current) {
          mapInstance.current.off("click", handleMapClick);
        }
      };
    }
  }, [isMapReady, nodesLoaded]);

  // Carga de rutas al inicializar
  useEffect(() => {
    const initializeRoutes = async () => {
      try {
        const success = await loadPredefinedRoutes();

        if (success) {
          setRoutesLoaded(true);

          if (mapInstance.current) {
            routeManager.displayRoutesOnMap(mapInstance.current, {
              color: "#FF6B35",
              weight: 3,
              opacity: 0.6,
              dashArray: "8, 4",
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
      const buildings = await fetchBuildings();
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

    window.openStaffModalById = async (buildingId) => {
      const building = buildingsData.find(
        (b) => String(b.id) === String(buildingId)
      );

      if (!building) {
        alert("No se encontró información del edificio");
        return;
      }

      try {
        const staff = await fetchStaffByBuildingName(building.name);

        setStaffModalBuilding({
          ...building,
          staff, // Agrega el personal directamente al edificio
        });

        setStaffModalOpen(true);
      } catch (error) {
        console.error("❌ Error al obtener el personal del edificio:", error);
        alert("Error al obtener el personal del edificio");
      }
    };

    window.getDirectionsOSM = async (buildingId, destLat, destLng) => {
      const building = buildingsData.find(
        (b) => String(b.id) === String(buildingId)
      );
      if (building) {
        // Usar una referencia para obtener el estado actual
        const currentLocation = userLocationRef.current;
        const currentTracking = isTrackingRef.current;
        
        console.log("🔍 getDirectionsOSM - ubicación actual:", currentLocation);
        console.log("🚀 getDirectionsOSM - tracking actual:", currentTracking);
        
        if (!currentLocation) {
          alert(
            "No se ha establecido tu ubicación. Por favor, activa el GPS usando el botón 'Iniciar GPS' en el header."
          );
          return;
        }
        
        try {
          await calculateRouteToBuilding(building, currentLocation);
        } catch (err) {
          alert(err.message);
        }
      }
    };

    window.handleLocationUpdate = (location) => {
      handleLocationUpdate(location);
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
      document.body.insertAdjacentHTML("beforeend", modalHtml);
    };

    window.closeImageModal = function () {
      const modal = document.getElementById("image-modal-overlay");
      if (modal) modal.remove();
    };

    return () => {
      delete window.openStaffModalById;
      delete window.getDirectionsOSM;
      delete window.handleLocationUpdate;
      delete window.openImageModal;
      delete window.closeImageModal;
      delete window.toggleDebugNodes;
    };
  }, [buildingsData, userLocation, isTracking]); // Agregar dependencias

  // FUNCIÓN: Crear ruta usando el sistema de nodos (ÚNICA OPCIÓN para rutas)
  const createRouteFromNodes = async (
    nodeRoute,
    currentUserLocation,
    building
  ) => {
    console.log("🎯 Creando ruta usando red de nodos");

    const routeLine = L.polyline(nodeRoute.coordinates, {
      color: "#00FF00", // Verde para rutas de nodos
      weight: 5,
      opacity: 0.9,
      dashArray: null,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(mapInstance.current);

    mapInstance.current.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

    const distanceKm = (nodeRoute.distance / 1000).toFixed(2);
    const durationMin = nodeRoute.duration;

    return {
      distance: `${distanceKm} km`,
      duration: `${durationMin} min`,
      routeLine: routeLine,
      source: nodeRoute.source,
      note: `Red de nodos: ${nodeRoute.pathNodes?.length || 0
        } puntos de control`,
      details: {
        accessDistance: nodeRoute.accessDistance,
        routeDistance: nodeRoute.routeDistance,
        pathNodes: nodeRoute.pathNodes,
      },
    };
  };

  // FUNCIÓN: OpenRouteService como último recurso
  const calculateWithOpenRouteService = async (
    currentUserLocation,
    building
  ) => {
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

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          minZoom: 10,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 2,
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

  // Mostrar senderos cuando el mapa esté listo
  useEffect(() => {
    if (mapInstance.current && routesLoaded) {
      routeManager.displayRoutesOnMap(mapInstance.current, {
        color: "#FF6B35",
        weight: 3,
        opacity: 0.6,
        dashArray: "8, 4",
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
        className: "custom-popup",
      });

      marker.on("click", () => {
        setSelectedBuilding(building);
      });

      buildingMarkersRef.current.push(marker);
    });

    // Marcar que los marcadores están listos
    setMarkersReady(true);
    console.log(
      "✅ Marcadores de edificios creados:",
      buildingMarkersRef.current.length
    );
  };

  // Manejar actualización de ubicación
  const handleLocationUpdate = (location) => {
    console.log("📍 handleLocationUpdate llamado con:", location);
    setUserLocation(location);
    userLocationRef.current = location; // Mantener ref actualizada

    if (mapInstance.current) {
      if (userMarkerRef.current) {
        mapInstance.current.removeLayer(userMarkerRef.current);
      }

      if (accuracyCircleRef.current) {
        mapInstance.current.removeLayer(accuracyCircleRef.current);
      }

      userMarkerRef.current = createUserMarker(
        mapInstance.current,
        location,
        location.accuracy
      );

      if (location.accuracy) {
        accuracyCircleRef.current = createAccuracyCircle(
          mapInstance.current,
          location,
          location.accuracy
        );
      }
      
      console.log("✅ Marcador de usuario actualizado en el mapa");
    }
  };

  // Toggle tracking
  const toggleTracking = async () => {
    if (isTracking) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      isTrackingRef.current = false; // Mantener ref actualizada
      setError("GPS detenido");
      setTimeout(() => setError(null), 2000);
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

        // Guardar la ubicación inmediatamente
        handleLocationUpdate(location);
        console.log("📍 Ubicación GPS obtenida:", location);

        // Centrar mapa en la ubicación
        if (mapInstance.current) {
          mapInstance.current.setView([location.lat, location.lng], 18);
        }

        // Iniciar el seguimiento continuo
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            };
            handleLocationUpdate(newLocation);
            console.log("📍 Ubicación actualizada:", newLocation);
          },
          (error) => {
            console.error("Error en seguimiento:", error);
            setError("Error en seguimiento GPS");
            setTimeout(() => setError(null), 3000);
          },
          LOCATION_OPTIONS
        );

        setIsTracking(true);
        isTrackingRef.current = true; // Mantener ref actualizada
        setError("✅ GPS activado exitosamente");
        setTimeout(() => setError(null), 3000);
      } catch (err) {
        setError(err.message);
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  // Calcular y mostrar ruta
  const calculateRouteToBuilding = async (building, currentUserLocation) => {
    const buildingName = building.name || `Edificio ${building.id}`;

    try {
      if (currentRouteRef.current) {
        mapInstance.current.removeLayer(currentRouteRef.current);
        currentRouteRef.current = null;
      }

      let result;

      // Usar sistema de nodos SOLO si está disponible y funcionando
      if (nodesLoaded) {
        console.log("🎯 Usando sistema de nodos para calcular ruta...");
        try {
          const nodeRoute = await nodeManager.calculateRoute(
            [currentUserLocation.lat, currentUserLocation.lng],
            [building.position.lat, building.position.lng],
            200
          );

          if (nodeRoute) {
            result = await createRouteFromNodes(
              nodeRoute,
              currentUserLocation,
              building
            );
            console.log("✅ Ruta calculada con sistema de nodos");
          } else {
            throw new Error(
              "No se pudo calcular una ruta a través de la red de nodos. Verifica que el edificio esté conectado a la red."
            );
          }
        } catch (nodeError) {
          console.error("❌ Error con red de nodos:", nodeError.message);
          console.error("📊 Stack trace:", nodeError.stack);

          // Solo como último recurso: OpenRouteService
          console.log("🔄 Último recurso: OpenRouteService...");
          try {
            result = await calculateWithOpenRouteService(
              currentUserLocation,
              building
            );
            console.log("⚠️ Usando OpenRouteService como último recurso");
          } catch (openRouteError) {
            throw new Error(
              `No se pudo calcular ruta: ${nodeError.message}. Tampoco disponible OpenRouteService: ${openRouteError.message}`
            );
          }
        }
      } else {
        // Si no hay nodos cargados, usar OpenRouteService directamente
        console.log(
          "⚠️ Red de nodos no disponible, usando OpenRouteService..."
        );
        try {
          result = await calculateWithOpenRouteService(
            currentUserLocation,
            building
          );
          console.log("⚠️ Usando OpenRouteService (nodos no disponibles)");
        } catch (openRouteError) {
          throw new Error(
            `Red de nodos no disponible y OpenRouteService falló: ${openRouteError.message}`
          );
        }
      }

      currentRouteRef.current = result.routeLine;

      // Mostrar información de la ruta
      const routeInfo =
        `🎯 Ruta a ${buildingName}\n\n` +
        `📏 Distancia: ${result.distance}\n` +
        `⏱️ Tiempo estimado: ${result.duration}\n` +
        `🚶‍♂️ Modo: Caminando\n` +
        `📍 Origen: Tu ubicación (GPS)\n` +
        `🌐 Fuente: ${result.source}\n` +
        (result.note ? `📝 ${result.note}\n` : "") +
        (result.details
          ? `🔍 Detalles: ${(result.details.accessDistance / 1000).toFixed(
            2
          )}km acceso + ${(result.details.routeDistance / 1000).toFixed(
            2
          )}km ruta`
          : "");

      alert(routeInfo);

      setSelectedBuilding(null);
      setError("✅ Ruta calculada exitosamente");

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
    console.log("🔍 handleGetDirections llamado para:", buildingName);
    console.log("📍 Estado actual de userLocation:", userLocation);
    console.log("🚀 Estado de tracking:", isTracking);

    let currentUserLocation = userLocation;

    if (!currentUserLocation) {
      console.warn("⚠️ No hay ubicación de usuario disponible");
      alert(
        "No se ha establecido tu ubicación. Por favor, activa el GPS usando el botón 'Iniciar GPS' en el header."
      );
      return;
    }

    try {
      console.log("✅ Ubicación disponible, calculando ruta...");
      await calculateRouteToBuilding(building, currentUserLocation);
    } catch (err) {
      console.error("❌ Error al calcular ruta:", err);
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
      console.log("Selected building from search:", selectedBuildingFromSearch);
      console.log("Markers available:", buildingMarkersRef.current.length);

      const { lat, lng } = selectedBuildingFromSearch.position;

      // Buscar el marcador correspondiente primero
      const marker = buildingMarkersRef.current.find(
        (m) => m.buildingId === selectedBuildingFromSearch.id
      );

      if (marker) {
        console.log(
          "Found marker, opening popup for:",
          selectedBuildingFromSearch.name
        );

        // Centrar el mapa en el edificio
        mapInstance.current.setView([lat, lng], 18);

        // Esperar a que el mapa se centre y luego abrir el popup
        setTimeout(() => {
          try {
            marker.openPopup();
            setSelectedBuilding(selectedBuildingFromSearch);
            console.log("Popup opened successfully");
          } catch (error) {
            console.error("Error abriendo popup:", error);
          }
        }, 500);
      } else {
        console.warn(
          "Marker not found for building:",
          selectedBuildingFromSearch
        );
        console.log(
          "Available marker IDs:",
          buildingMarkersRef.current.map((m) => m.buildingId)
        );
      }
    }
  }, [selectedBuildingFromSearch?.searchTimestamp, markersReady]);

  return (
    <div className="openstreetmap-container">
      {/* Debug Panel */}
      {nodesLoaded && (
        <div className="debug-panel">
          <strong>🎯 Sistema de Rutas:</strong>
          <br />✅ Nodos: {nodeManager.nodes.size}
          <br />
          {routesLoaded && "🎨 Senderos: Solo visual"}
          <br />
          <button
            onClick={() => window.toggleDebugNodes && window.toggleDebugNodes()}
            className={showDebugNodes ? "active" : ""}
          >
            {showDebugNodes ? "Ocultar" : "Mostrar"} Nodos
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          style={{
            position: "fixed",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: error.includes("✅") ? "#e8f5e8" : "#ffebee",
            border: `1px solid ${error.includes("✅") ? "#4caf50" : "#f44336"}`,
            color: error.includes("✅") ? "#2e7d32" : "#c62828",
            padding: "10px 20px",
            borderRadius: "4px",
            zIndex: 1001,
            maxWidth: "90%",
            textAlign: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      />

      {/* Staff Modal */}
      <StaffModal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        building={staffModalBuilding}
      />
    </div>
  );
};

export default OpenStreetMapComponent;