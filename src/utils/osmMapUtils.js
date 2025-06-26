// utils/osmMapUtils.js
import L from 'leaflet';
import NotFoundImg from "../assets/Not-found-2.png";
import MackersImage from "../assets/Macker_1.png";
import UserLocationIcon from "../assets/user-location.png";

/**
 * 🗺️ NO NECESARIO - Leaflet se carga automáticamente con npm install
 * (Equivalente a loadGoogleMapsAPI pero no necesario)
 */
export const initializeLeaflet = () => {
    // Leaflet ya está disponible globalmente después del import
    console.log("✅ Leaflet inicializado");
    return Promise.resolve();
};

/**
 * 🔒 NO NECESARIO - OpenStreetMap no tiene restricciones de vista
 * (Equivalente a enforceRoadmapView pero no necesario)
 */
export const configureMapDefaults = (map) => {
    // OpenStreetMap por defecto ya es vista estándar
    console.log('🗺️ Configuración de mapa OSM aplicada');
    return map;
};

/**
 * Crea un marcador de usuario con animación
 * CAMBIA: Usa L.marker en lugar de google.maps.Marker
 */
export const createUserMarker = (map, position, accuracy) => {
    // Crear icono simple para el usuario (no requiere archivo externo)
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: #4285F4;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });

    // Crear marcador con Leaflet
    const marker = L.marker([position.lat, position.lng], {
        icon: userIcon,
        zIndexOffset: 1000
    }).addTo(map);

    // Agregar popup con información
    marker.bindPopup(`Tu ubicación (±${Math.round(accuracy)}m)`, {
        offset: [0, -10]
    });

    console.log('📍 Marcador de usuario creado');
    return marker;
};

/**
 * Crea un marcador de edificio
 * CAMBIA: Usa L.marker en lugar de AdvancedMarkerElement
 */
export const createBuildingMarker = (map, building) => {
    // Crear icono personalizado para edificios
    const buildingIcon = L.icon({
        iconUrl: MackersImage,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        className: 'building-marker'
    });

    // Crear marcador con Leaflet
    const marker = L.marker([building.position.lat, building.position.lng], {
        icon: buildingIcon,
        title: building.name
    }).addTo(map);

    console.log(`🏢 Marcador de edificio creado: ${building.name}`);
    return marker;
};

/**
 * Crea círculo de precisión para la ubicación del usuario
 * CAMBIA: Usa L.circle en lugar de google.maps.Circle
 */
export const createAccuracyCircle = (map, position, accuracy) => {
    const circle = L.circle([position.lat, position.lng], {
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        radius: accuracy,
        weight: 2
    }).addTo(map);

    console.log('⭕ Círculo de precisión creado');
    return circle;
};

/**
 * Crea contenido para popup de edificio
 * CAMBIA: Formato adaptado para Leaflet popups
 */
export const createBuildingPopupContent = (building) => {
    const imageSrc = building.image && building.image.trim() !== "" ? building.image : NotFoundImg;

    return `
        <div class="leaflet-popup-content-custom" style="max-width: 250px; font-family: sans-serif; font-size: 14px;">
            <h3 style="color: #1976d2; margin-bottom: 8px; font-size: 16px;">${building.name}</h3>
            
            <div style="width: 100%; height: 100px; overflow: hidden; border-radius: 6px; margin-bottom: 8px;">
                <img 
                    src="${imageSrc}" 
                    alt="${building.name}" 
                    onclick="window.openImageModal('${imageSrc}')"
                    style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; cursor: pointer;" 
                />
            </div>

            <button 
                onclick="window.openStaffModalById('${building.id}')"
                title="Ver personal del edificio"
                style="margin-bottom: 6px; padding: 4px 8px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                👥 Ver Personal
            </button>

            <button 
                id="directions-btn-${building.id}" 
                onclick="window.getDirectionsOSM('${building.id}', ${building.position.lat}, ${building.position.lng})"
                style="padding: 6px 12px; background: #4285F4; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                🗺️ Cómo llegar
            </button>
        </div>
    `;
};

/**
 * Mantiene las funciones de modal de imagen (sin cambios)
 */
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
        " onclick="window.closeImageModal()">
            <img src="${imageUrl}" alt="Imagen ampliada" style="
                max-width: 80%;
                max-height: 80%;
                border-radius: 8px;
                box-shadow: 0 0 20px #000;
            " onclick="event.stopPropagation()" />
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeImageModal = function () {
    const modal = document.getElementById('image-modal-overlay');
    if (modal) modal.remove();
};

/**
 * Calcula y muestra direcciones usando OpenRouteService
 * 🚗 Usa OpenRouteService API específicamente
 */
export const calculateAndShowDirections = async (map, origin, destination) => {
    try {
        console.log('🧮 Calculando ruta con OpenRouteService...');

        // Importar configuración
        const { OPENROUTE_CONFIG, buildOpenRouteURL } = await import('../data/buildingsData.js');

        // Verificar si hay API key configurada
        if (!OPENROUTE_CONFIG.apiKey) {
            console.warn('⚠️ API key de OpenRouteService no configurada, usando fallback');
            return await calculateDirectRoute(map, origin, destination);
        }

        // Construir URL para OpenRouteService
        const url = buildOpenRouteURL(origin, destination, 'walking');

        console.log('🌐 Solicitando ruta a:', url.split('?')[0]);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`OpenRouteService error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.features && data.features[0]) {
            // Procesar respuesta de OpenRouteService
            const route = data.features[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

            // Dibujar ruta en el mapa
            const routeLine = L.polyline(coordinates, {
                color: '#4285F4',
                weight: 4,
                opacity: 0.8,
                dashArray: null // Línea sólida para rutas reales
            }).addTo(map);

            // Ajustar vista para mostrar toda la ruta
            map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

            // Extraer información de la ruta
            const summary = route.properties.summary;
            const distance = (summary.distance / 1000).toFixed(2);
            const duration = Math.round(summary.duration / 60);

            console.log('✅ Ruta calculada con OpenRouteService');

            return {
                distance: `${distance} km`,
                duration: `${duration} min`,
                routeLine: routeLine,
                source: 'OpenRouteService'
            };

        } else {
            throw new Error('No se encontró ruta en la respuesta de OpenRouteService');
        }

    } catch (error) {
        console.error('❌ Error con OpenRouteService:', error);
        console.log('🔄 Usando ruta directa como fallback...');

        // Fallback a ruta directa
        return await calculateDirectRoute(map, origin, destination);
    }
};

/**
 * Calcular y mostrar ruta directa como fallback
 */
const calculateDirectRoute = async (map, origin, destination) => {
    console.log('📐 Calculando ruta directa...');

    // Calcular distancia directa
    const directDistance = calculateDirectDistance(origin, destination);
    const estimatedTime = Math.round(directDistance * 12); // ~12 min por km caminando

    // Dibujar línea directa
    const directLine = L.polyline([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
    ], {
        color: '#FF9800',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10' // Línea discontinua para indicar que es estimación
    }).addTo(map);

    map.fitBounds(directLine.getBounds(), { padding: [20, 20] });

    return {
        distance: `~${directDistance.toFixed(2)} km`,
        duration: `~${estimatedTime} min`,
        routeLine: directLine,
        source: 'Distancia directa',
        note: 'Ruta estimada (línea directa)'
    };
};

/**
 * Calcular distancia directa entre dos puntos (Haversine formula)
 */
const calculateDirectDistance = (origin, destination) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLng = (destination.lng - origin.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Función global para manejo de direcciones desde popups
 */
window.getDirectionsOSM = async function (buildingId, destLat, destLng) {
    // Esta función será llamada desde el popup
    // Necesita acceso al estado de ubicación del usuario y el mapa
    const event = new CustomEvent('requestDirections', {
        detail: { buildingId, destLat, destLng }
    });
    window.dispatchEvent(event);
};

/**
 * Configuración del mapa con las opciones por defecto
 * CAMBIA: Configuración específica para Leaflet
 */
export const setupMapDefaults = (mapElement, centerLat, centerLng, zoom = 18) => {
    const map = L.map(mapElement, {
        center: [centerLat, centerLng],
        zoom: zoom,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true
    });

    // Agregar capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 10
    }).addTo(map);

    console.log('🔧 Mapa OSM configurado con opciones por defecto');
    return map;
};

/**
 * Utilidad para convertir coordenadas de Google Maps a Leaflet
 */
export const convertGoogleCoordsToLeaflet = (googleLatLng) => {
    if (googleLatLng.lat && googleLatLng.lng) {
        return [googleLatLng.lat, googleLatLng.lng];
    }
    return googleLatLng;
};

/**
 * Utilidad para limpiar rutas anteriores del mapa
 */
export const clearPreviousRoutes = (map) => {
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline && layer.options.color === '#4285F4') {
            map.removeLayer(layer);
        }
    });
};