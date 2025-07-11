// utils/osmMapUtils.js - CON DEBUG DETALLADO
import L from 'leaflet';
import NotFoundImg from "../assets/Not-found-2.png";
import MackersImage from "../assets/Macker_1.png";

export const createUserMarker = (map, position, accuracy) => {
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

    const marker = L.marker([position.lat, position.lng], {
        icon: userIcon,
        zIndexOffset: 1000
    }).addTo(map);

    marker.bindPopup(`Tu ubicación (±${Math.round(accuracy)}m)`, {
        offset: [0, -10]
    });

    console.log('📍 Marcador de usuario creado');
    return marker;
};

export const createBuildingMarker = (map, building) => {
    const buildingIcon = L.icon({
        iconUrl: MackersImage,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        className: 'building-marker'
    });

    const marker = L.marker([building.position.lat, building.position.lng], {
        icon: buildingIcon,
        title: building.name
    }).addTo(map);

    console.log(`🏢 Marcador de edificio creado: ${building.name}`);
    return marker;
};

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
 * 🎯 FUNCIÓN PRINCIPAL CON DEBUG EXHAUSTIVO
 */
export const calculateAndShowDirections = async (map, origin, destination, routeManager = null) => {
    try {
        console.log('\n🚀 ========================================');
        console.log('🚀 === INICIANDO CÁLCULO DE RUTA (DEBUG) ===');
        console.log('🚀 ========================================');
        console.log(`📍 Origen: [${origin.lat}, ${origin.lng}]`);
        console.log(`🎯 Destino: [${destination.lat}, ${destination.lng}]`);
        console.log(`🔧 RouteManager recibido: ${!!routeManager}`);

        // 🔍 DIAGNÓSTICO COMPLETO DEL ROUTE MANAGER
        if (routeManager) {
            console.log('\n🔍 === DIAGNÓSTICO DEL ROUTE MANAGER ===');
            console.log(`   ✅ RouteManager existe: ${!!routeManager}`);
            console.log(`   📊 NodeGraph existe: ${!!routeManager.nodeGraph}`);
            console.log(`   📊 NodeGraph es Map: ${routeManager.nodeGraph instanceof Map}`);
            console.log(`   📊 Tamaño NodeGraph: ${routeManager.nodeGraph?.size || 0}`);
            console.log(`   📍 NodePositions existe: ${!!routeManager.nodePositions}`);
            console.log(`   📍 Tamaño NodePositions: ${routeManager.nodePositions?.size || 0}`);
            console.log(`   📏 RouteSegments existe: ${!!routeManager.routeSegments}`);
            console.log(`   📏 Cantidad RouteSegments: ${routeManager.routeSegments?.length || 0}`);
            console.log(`   🔧 Función calculateCustomRoute: ${typeof routeManager.calculateCustomRoute}`);
            console.log(`   🔧 Función getTotalConnections: ${typeof routeManager.getTotalConnections}`);

            // Verificar que las funciones críticas existan
            const criticalFunctions = ['calculateCustomRoute', 'nodeGraph', 'nodePositions'];
            const missingFunctions = criticalFunctions.filter(func => !routeManager[func]);

            if (missingFunctions.length > 0) {
                console.log(`   ❌ FUNCIONES FALTANTES: ${missingFunctions.join(', ')}`);
            } else {
                console.log(`   ✅ Todas las funciones críticas están presentes`);
            }

            // Verificar estado interno detallado
            if (routeManager.nodeGraph && routeManager.nodeGraph.size > 0) {
                console.log('\n📊 === ESTADO DETALLADO DEL GRAFO ===');
                console.log(`   🔗 Total conexiones: ${routeManager.getTotalConnections?.() || 'N/A'}`);

                // Mostrar algunos nodos de ejemplo
                const sampleNodes = Array.from(routeManager.nodePositions?.keys() || []).slice(0, 3);
                console.log(`   📍 Nodos de ejemplo (primeros 3):`);
                sampleNodes.forEach(nodeId => {
                    const position = routeManager.nodePositions.get(nodeId);
                    const connections = routeManager.nodeGraph.get(nodeId);
                    console.log(`     ${nodeId}: [${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}] - ${connections?.size || 0} conexiones`);
                });

                // Verificar área de cobertura
                console.log('\n📐 === VERIFICANDO COBERTURA DEL GRAFO ===');
                const allPositions = Array.from(routeManager.nodePositions.values());
                const lats = allPositions.map(p => p.lat);
                const lngs = allPositions.map(p => p.lng);

                const bounds = {
                    minLat: Math.min(...lats),
                    maxLat: Math.max(...lats),
                    minLng: Math.min(...lngs),
                    maxLng: Math.max(...lngs)
                };

                console.log(`   📊 Límites del grafo:`);
                console.log(`     Latitud: ${bounds.minLat.toFixed(6)} a ${bounds.maxLat.toFixed(6)}`);
                console.log(`     Longitud: ${bounds.minLng.toFixed(6)} a ${bounds.maxLng.toFixed(6)}`);

                // Verificar si origen y destino están dentro del área
                const originInBounds = origin.lat >= bounds.minLat && origin.lat <= bounds.maxLat &&
                    origin.lng >= bounds.minLng && origin.lng <= bounds.maxLng;
                const destInBounds = destination.lat >= bounds.minLat && destination.lat <= bounds.maxLat &&
                    destination.lng >= bounds.minLng && destination.lng <= bounds.maxLng;

                console.log(`   📍 Origen dentro del área: ${originInBounds ? '✅' : '❌'}`);
                console.log(`   🎯 Destino dentro del área: ${destInBounds ? '✅' : '❌'}`);

                if (!originInBounds) {
                    console.log(`   ⚠️ ORIGEN FUERA DEL ÁREA DEL GRAFO`);
                    console.log(`     Origen: [${origin.lat}, ${origin.lng}]`);
                    console.log(`     Diferencia lat: ${Math.min(Math.abs(origin.lat - bounds.minLat), Math.abs(origin.lat - bounds.maxLat)).toFixed(6)}`);
                    console.log(`     Diferencia lng: ${Math.min(Math.abs(origin.lng - bounds.minLng), Math.abs(origin.lng - bounds.maxLng)).toFixed(6)}`);
                }

                if (!destInBounds) {
                    console.log(`   ⚠️ DESTINO FUERA DEL ÁREA DEL GRAFO`);
                    console.log(`     Destino: [${destination.lat}, ${destination.lng}]`);
                    console.log(`     Diferencia lat: ${Math.min(Math.abs(destination.lat - bounds.minLat), Math.abs(destination.lat - bounds.maxLat)).toFixed(6)}`);
                    console.log(`     Diferencia lng: ${Math.min(Math.abs(destination.lng - bounds.minLng), Math.abs(destination.lng - bounds.maxLng)).toFixed(6)}`);
                }
            }
        } else {
            console.log('\n❌ === ROUTE MANAGER NO DISPONIBLE ===');
            console.log('   RouteManager es null o undefined');
        }

        // 🎯 PRIORIDAD 1: INTENTAR RUTAS GEOJSON CON PESOS
        if (routeManager &&
            routeManager.nodeGraph &&
            routeManager.nodeGraph instanceof Map &&
            routeManager.nodeGraph.size > 0 &&
            typeof routeManager.calculateCustomRoute === 'function') {

            console.log('\n🏃‍♂️ === INTENTANDO SISTEMA DE PESOS GEOJSON ===');
            console.log(`📊 Condiciones verificadas:`);
            console.log(`   ✅ RouteManager existe`);
            console.log(`   ✅ NodeGraph es Map válido con ${routeManager.nodeGraph.size} nodos`);
            console.log(`   ✅ Función calculateCustomRoute disponible`);

            try {
                console.log('\n🔄 Llamando a routeManager.calculateCustomRoute...');
                const customRoute = routeManager.calculateCustomRoute(
                    origin.lat,
                    origin.lng,
                    destination.lat,
                    destination.lng
                );

                console.log(`\n📋 Resultado de calculateCustomRoute:`);
                console.log(`   Resultado: ${customRoute ? 'OBJETO VÁLIDO' : 'NULL/UNDEFINED'}`);

                if (customRoute) {
                    console.log(`   ✅ CustomRoute recibido:`);
                    console.log(`     - Coordinates: ${customRoute.coordinates ? customRoute.coordinates.length + ' puntos' : 'No disponible'}`);
                    console.log(`     - Distance: ${customRoute.distance || 'No disponible'}`);
                    console.log(`     - Path: ${customRoute.path ? customRoute.path.length + ' nodos' : 'No disponible'}`);
                    console.log(`     - SegmentsUsed: ${customRoute.segmentsUsed ? customRoute.segmentsUsed.length + ' segmentos' : 'No disponible'}`);

                    if (customRoute.coordinates && customRoute.coordinates.length > 0) {
                        console.log('\n🎨 === CREANDO RUTA VISUAL ===');

                        // Crear la ruta visual en el mapa
                        const routeLine = L.polyline(customRoute.coordinates, {
                            color: '#4285F4', // Azul para rutas GeoJSON
                            weight: 5,
                            opacity: 0.9,
                            dashArray: null, // Línea sólida
                            className: 'weighted-route'
                        }).addTo(map);

                        // Ajustar vista para mostrar toda la ruta
                        map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

                        // Calcular información de la ruta
                        const distanceKm = (customRoute.distance / 1000).toFixed(2);
                        const durationMin = Math.round(customRoute.distance / 1000 * 12); // ~12 min por km caminando

                        console.log('✅ === ÉXITO: RUTA GEOJSON CREADA ===');
                        console.log(`   📏 Distancia: ${distanceKm} km`);
                        console.log(`   ⏱️ Duración: ${durationMin} min`);
                        console.log(`   🎨 Ruta dibujada en azul sólido`);

                        return {
                            distance: `${distanceKm} km`,
                            duration: `${durationMin} min`,
                            routeLine: routeLine,
                            source: 'Rutas del Campus (Pesos Optimizados)',
                            note: `${customRoute.segmentsUsed?.length || 0} segmentos del campus`,
                            routeType: 'weighted_geojson'
                        };
                    } else {
                        console.log('❌ CustomRoute sin coordenadas válidas');
                    }
                } else {
                    console.log('❌ calculateCustomRoute devolvió null/undefined');
                }
            } catch (error) {
                console.error('❌ Error ejecutando calculateCustomRoute:', error);
                console.error('Stack trace:', error.stack);
            }
        } else {
            console.log('\n❌ === SISTEMA DE PESOS NO DISPONIBLE ===');
            console.log('   Razones posibles:');
            console.log(`   - RouteManager: ${!!routeManager ? '✅' : '❌'}`);
            console.log(`   - NodeGraph: ${!!(routeManager?.nodeGraph) ? '✅' : '❌'}`);
            console.log(`   - NodeGraph es Map: ${routeManager?.nodeGraph instanceof Map ? '✅' : '❌'}`);
            console.log(`   - NodeGraph no vacío: ${(routeManager?.nodeGraph?.size || 0) > 0 ? '✅' : '❌'}`);
            console.log(`   - Función calculateCustomRoute: ${typeof routeManager?.calculateCustomRoute === 'function' ? '✅' : '❌'}`);
        }

        // 🌐 PRIORIDAD 2: OPENROUTESERVICE API
        console.log('\n🌐 === INTENTANDO OPENROUTESERVICE ===');

        try {
            const { OPENROUTE_CONFIG, buildOpenRouteURL } = await import('../data/buildingsData.js');

            if (!OPENROUTE_CONFIG.apiKey) {
                console.warn('⚠️ API key de OpenRouteService no configurada');
                throw new Error('API key no disponible');
            }

            const url = buildOpenRouteURL(origin, destination, 'walking');
            console.log('🌐 Solicitando ruta a OpenRouteService...');

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
                console.log('✅ === ÉXITO: RUTA OPENROUTESERVICE ===');

                const route = data.features[0];
                const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

                const routeLine = L.polyline(coordinates, {
                    color: '#FF9800', // Naranja para rutas externas
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '10, 5', // Línea punteada
                    className: 'external-route'
                }).addTo(map);

                map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

                const summary = route.properties.summary;
                const distance = (summary.distance / 1000).toFixed(2);
                const duration = Math.round(summary.duration / 60);

                console.log(`   📏 Distancia: ${distance} km`);
                console.log(`   ⏱️ Duración: ${duration} min`);
                console.log(`   🎨 Ruta dibujada en naranja punteado`);

                return {
                    distance: `${distance} km`,
                    duration: `${duration} min`,
                    routeLine: routeLine,
                    source: 'OpenRouteService (API Externa)',
                    note: 'Ruta calculada por servicio externo',
                    routeType: 'external_api'
                };
            } else {
                throw new Error('No se encontró ruta en la respuesta de OpenRouteService');
            }

        } catch (apiError) {
            console.error('❌ Error con OpenRouteService:', apiError);
            console.log('🔄 Fallback a ruta directa...');
        }

        // 📐 PRIORIDAD 3: Ruta directa (último recurso)
        console.log('\n📐 === CALCULANDO RUTA DIRECTA (ÚLTIMO RECURSO) ===');
        return await calculateDirectRoute(map, origin, destination);

    } catch (error) {
        console.error('❌ Error general en cálculo de ruta:', error);
        console.error('Stack trace completo:', error.stack);
        console.log('🔄 Fallback a ruta directa...');
        return await calculateDirectRoute(map, origin, destination);
    }
};

const calculateDirectRoute = async (map, origin, destination) => {
    console.log('📐 Calculando ruta directa (último recurso)...');

    const directDistance = calculateDirectDistance(origin, destination);
    const estimatedTime = Math.round(directDistance * 12); // ~12 min por km caminando

    const directLine = L.polyline([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
    ], {
        color: '#FF5722', // Rojo para estimación
        weight: 3,
        opacity: 0.7,
        dashArray: '15, 10', // Muy discontinua
        className: 'direct-route'
    }).addTo(map);

    map.fitBounds(directLine.getBounds(), { padding: [20, 20] });

    console.log('✅ === RUTA DIRECTA CREADA ===');
    console.log(`   📏 Distancia: ${directDistance.toFixed(2)} km`);
    console.log(`   ⏱️ Duración estimada: ${estimatedTime} min`);
    console.log(`   🎨 Ruta dibujada en rojo muy punteado`);

    return {
        distance: `~${directDistance.toFixed(2)} km`,
        duration: `~${estimatedTime} min`,
        routeLine: directLine,
        source: 'Distancia Directa (Estimación)',
        note: 'Línea recta - no considera obstáculos',
        routeType: 'direct_line'
    };
};

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

// Funciones globales
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

window.getDirectionsOSM = async function (buildingId, destLat, destLng) {
    const event = new CustomEvent('requestDirections', {
        detail: { buildingId, destLat, destLng }
    });
    window.dispatchEvent(event);
};

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

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        maxZoom: 19,
        minZoom: 10
    }).addTo(map);

    console.log('🔧 Mapa OSM configurado con opciones por defecto');
    return map;
};

export const clearPreviousRoutes = (map) => {
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline &&
            (layer.options.className === 'weighted-route' ||
                layer.options.className === 'external-route' ||
                layer.options.className === 'direct-route' ||
                layer.options.color === '#4285F4' ||
                layer.options.color === '#FF9800' ||
                layer.options.color === '#FF5722')) {
            map.removeLayer(layer);
        }
    });
    console.log('🧹 Rutas anteriores limpiadas');
};