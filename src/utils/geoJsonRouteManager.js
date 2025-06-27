// utils/geoJsonRouteManager.js - Versión mejorada
import L from 'leaflet';

export class GeoJSONRouteManager {
    constructor() {
        this.routeData = null;
        this.routeLayer = null;
        this.routeSegments = [];
        this.nodeNetwork = new Map(); // Red de nodos conectados
        this.spatialIndex = []; // Índice espacial para búsqueda rápida
    }

    /**
     * 🔄 Carga automática de múltiples archivos GeoJSON desde una carpeta
     */
    async loadRoutesFromFolder(geoJsonFiles) {
        try {
            console.log('📂 Cargando rutas desde múltiples archivos...');

            const allFeatures = [];

            for (const file of geoJsonFiles) {
                try {
                    let geoJsonData;

                    if (typeof file === 'string') {
                        // Cargar desde URL
                        const response = await fetch(file);
                        if (!response.ok) {
                            console.warn(`⚠️ No se pudo cargar ${file}`);
                            continue;
                        }
                        geoJsonData = await response.json();
                    } else {
                        // Archivo local
                        geoJsonData = file;
                    }

                    if (geoJsonData.features) {
                        allFeatures.push(...geoJsonData.features);
                        console.log(`✅ Cargado: ${geoJsonData.features.length} rutas de ${file.name || file}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Error cargando archivo:`, error);
                }
            }

            // Crear un GeoJSON combinado
            this.routeData = {
                type: "FeatureCollection",
                features: allFeatures
            };

            this.processAdvancedRouteNetwork();

            console.log(`✅ Sistema de rutas cargado: ${this.routeSegments.length} segmentos total`);
            return true;

        } catch (error) {
            console.error('❌ Error cargando rutas:', error);
            throw error;
        }
    }

    /**
     * 🧠 Procesamiento avanzado de la red de rutas con algoritmo mejorado
     */
    processAdvancedRouteNetwork() {
        if (!this.routeData || !this.routeData.features) {
            throw new Error('Datos GeoJSON inválidos');
        }

        this.routeSegments = [];
        this.nodeNetwork.clear();
        this.spatialIndex = [];

        // Procesar cada segmento
        this.routeData.features.forEach((feature, index) => {
            if (feature.geometry && feature.geometry.type === 'LineString') {
                const coordinates = feature.geometry.coordinates;
                const leafletCoords = coordinates.map(coord => [coord[1], coord[0]]);

                const segment = {
                    id: index,
                    coordinates: leafletCoords,
                    originalCoords: coordinates,
                    properties: feature.properties || {},
                    length: this.calculateSegmentLength(leafletCoords),
                    startNode: this.createNodeKey(leafletCoords[0]),
                    endNode: this.createNodeKey(leafletCoords[leafletCoords.length - 1])
                };

                this.routeSegments.push(segment);
                this.addSegmentToSpatialIndex(segment);
                this.addSegmentToNetwork(segment);
            }
        });

        // Conectar nodos cercanos
        this.connectNearbyNodes();

        console.log(`🔗 Red procesada: ${this.routeSegments.length} segmentos, ${this.nodeNetwork.size} nodos`);
    }

    /**
     * 📍 Crea una clave única para un nodo basada en coordenadas
     */
    createNodeKey(coord, precision = 6) {
        return `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
    }

    /**
     * 🗺️ Agrega segmento al índice espacial para búsquedas rápidas
     */
    addSegmentToSpatialIndex(segment) {
        // Calcular bounding box del segmento
        const lats = segment.coordinates.map(c => c[0]);
        const lngs = segment.coordinates.map(c => c[1]);

        const bbox = {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs),
            segment: segment
        };

        this.spatialIndex.push(bbox);
    }

    /**
     * 🔗 Agrega segmento a la red de nodos
     */
    addSegmentToNetwork(segment) {
        const startKey = segment.startNode;
        const endKey = segment.endNode;

        // Inicializar nodos si no existen
        if (!this.nodeNetwork.has(startKey)) {
            this.nodeNetwork.set(startKey, {
                coordinates: segment.coordinates[0],
                connections: []
            });
        }

        if (!this.nodeNetwork.has(endKey)) {
            this.nodeNetwork.set(endKey, {
                coordinates: segment.coordinates[segment.coordinates.length - 1],
                connections: []
            });
        }

        // Agregar conexiones bidireccionales
        this.nodeNetwork.get(startKey).connections.push({
            to: endKey,
            segment: segment,
            distance: segment.length,
            direction: 'forward'
        });

        this.nodeNetwork.get(endKey).connections.push({
            to: startKey,
            segment: segment,
            distance: segment.length,
            direction: 'reverse'
        });
    }

    /**
     * 🔗 Conecta nodos que están muy cerca pero no directamente conectados
     */
    connectNearbyNodes() {
        const tolerance = 20; // 20 metros de tolerancia
        const nodes = Array.from(this.nodeNetwork.entries());

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const [keyA, nodeA] = nodes[i];
                const [keyB, nodeB] = nodes[j];

                const distance = this.calculateDistance(
                    nodeA.coordinates[0], nodeA.coordinates[1],
                    nodeB.coordinates[0], nodeB.coordinates[1]
                );

                if (distance <= tolerance) {
                    // Crear conexión virtual entre nodos cercanos
                    const alreadyConnected = nodeA.connections.some(conn => conn.to === keyB);

                    if (!alreadyConnected) {
                        nodeA.connections.push({
                            to: keyB,
                            segment: null, // Conexión virtual
                            distance: distance,
                            direction: 'virtual'
                        });

                        nodeB.connections.push({
                            to: keyA,
                            segment: null,
                            distance: distance,
                            direction: 'virtual'
                        });

                        console.log(`🔗 Conectados nodos cercanos: ${distance.toFixed(1)}m`);
                    }
                }
            }
        }
    }

    /**
     * 🎯 Búsqueda espacial optimizada para encontrar segmentos cercanos
     */
    findNearestRoutePointOptimized(targetLat, targetLng, maxDistance = 150) {
        let nearestPoint = null;
        let minDistance = maxDistance;

        // Filtrar segmentos por bounding box primero
        const candidateSegments = this.spatialIndex.filter(bbox => {
            const margin = 0.002; // ~200m en grados
            return targetLat >= (bbox.minLat - margin) &&
                targetLat <= (bbox.maxLat + margin) &&
                targetLng >= (bbox.minLng - margin) &&
                targetLng <= (bbox.maxLng + margin);
        }).map(bbox => bbox.segment);

        // Buscar el punto más cercano en los segmentos candidatos
        for (const segment of candidateSegments) {
            const closestPoint = this.findClosestPointOnSegment(
                segment.coordinates,
                [targetLat, targetLng]
            );

            if (closestPoint.distance < minDistance) {
                minDistance = closestPoint.distance;
                nearestPoint = {
                    coordinates: closestPoint.point,
                    segment: segment,
                    distance: closestPoint.distance,
                    segmentIndex: closestPoint.segmentIndex,
                    ratio: closestPoint.ratio
                };
            }
        }

        return nearestPoint;
    }

    /**
     * 📐 Encuentra el punto más cercano en un segmento de línea
     */
    findClosestPointOnSegment(coordinates, targetPoint) {
        let minDistance = Infinity;
        let closestPoint = null;
        let bestSegmentIndex = 0;
        let bestRatio = 0;

        for (let i = 0; i < coordinates.length - 1; i++) {
            const segmentStart = coordinates[i];
            const segmentEnd = coordinates[i + 1];

            const result = this.pointToLineDistance(targetPoint, segmentStart, segmentEnd);

            if (result.distance < minDistance) {
                minDistance = result.distance;
                closestPoint = result.point;
                bestSegmentIndex = i;
                bestRatio = result.ratio;
            }
        }

        return {
            point: closestPoint,
            distance: minDistance,
            segmentIndex: bestSegmentIndex,
            ratio: bestRatio
        };
    }

    /**
     * 📏 Calcula la distancia más corta de un punto a una línea
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const [px, py] = point;
        const [x1, y1] = lineStart;
        const [x2, y2] = lineEnd;

        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        const distance = this.calculateDistance(px, py, xx, yy);

        return {
            point: [xx, yy],
            distance: distance,
            ratio: Math.max(0, Math.min(1, param))
        };
    }

    /**
     * 🗺️ Algoritmo mejorado de cálculo de rutas usando Dijkstra
     */
    calculateCustomRoute(originLat, originLng, destLat, destLng) {
        console.log('🗺️ Calculando ruta con algoritmo mejorado...');

        // Encontrar puntos de acceso más cercanos
        const nearestOrigin = this.findNearestRoutePointOptimized(originLat, originLng, 200);
        const nearestDest = this.findNearestRoutePointOptimized(destLat, destLng, 200);

        if (!nearestOrigin || !nearestDest) {
            console.warn('⚠️ No se encontraron puntos de acceso a la red de rutas');
            return null;
        }

        console.log(`🎯 Puntos de acceso encontrados: ${nearestOrigin.distance.toFixed(1)}m y ${nearestDest.distance.toFixed(1)}m`);

        // Encontrar nodos más cercanos a los puntos de acceso
        const originNode = this.findNearestNode(nearestOrigin.coordinates);
        const destNode = this.findNearestNode(nearestDest.coordinates);

        if (!originNode || !destNode) {
            console.warn('⚠️ No se encontraron nodos en la red');
            return null;
        }

        // Usar Dijkstra para encontrar la mejor ruta
        const path = this.dijkstraPath(originNode.key, destNode.key);

        if (!path || path.length === 0) {
            console.warn('⚠️ No se encontró camino en la red de rutas');
            return null;
        }

        // Construir las coordenadas completas de la ruta
        const routeCoordinates = this.buildCompleteRoute(
            [originLat, originLng],
            nearestOrigin,
            path,
            nearestDest,
            [destLat, destLng]
        );

        const totalDistance = nearestOrigin.distance + path.distance + nearestDest.distance;

        console.log(`✅ Ruta calculada: ${(totalDistance / 1000).toFixed(2)}km usando ${path.segments.length} segmentos`);

        return {
            coordinates: routeCoordinates,
            distance: totalDistance,
            segments: path.segments,
            useCustomRoutes: true,
            accessDistance: nearestOrigin.distance + nearestDest.distance,
            routeDistance: path.distance
        };
    }

    /**
     * 🔍 Encuentra el nodo más cercano a unas coordenadas
     */
    findNearestNode(coordinates) {
        let nearestNode = null;
        let minDistance = Infinity;

        for (const [key, node] of this.nodeNetwork) {
            const distance = this.calculateDistance(
                coordinates[0], coordinates[1],
                node.coordinates[0], node.coordinates[1]
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = { key, node, distance };
            }
        }

        return nearestNode;
    }

    /**
     * 🚀 Algoritmo de Dijkstra para encontrar la ruta más corta
     */
    dijkstraPath(startKey, endKey) {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        // Inicializar distancias
        for (const nodeKey of this.nodeNetwork.keys()) {
            distances.set(nodeKey, Infinity);
            unvisited.add(nodeKey);
        }
        distances.set(startKey, 0);

        while (unvisited.size > 0) {
            // Encontrar nodo no visitado con menor distancia
            let currentNode = null;
            let minDistance = Infinity;

            for (const nodeKey of unvisited) {
                if (distances.get(nodeKey) < minDistance) {
                    minDistance = distances.get(nodeKey);
                    currentNode = nodeKey;
                }
            }

            if (currentNode === null || minDistance === Infinity) {
                break; // No hay más nodos alcanzables
            }

            unvisited.delete(currentNode);

            // Si llegamos al destino, construir el camino
            if (currentNode === endKey) {
                return this.reconstructPath(previous, startKey, endKey, distances.get(endKey));
            }

            // Examinar vecinos
            const node = this.nodeNetwork.get(currentNode);
            for (const connection of node.connections) {
                if (!unvisited.has(connection.to)) continue;

                const alt = distances.get(currentNode) + connection.distance;
                if (alt < distances.get(connection.to)) {
                    distances.set(connection.to, alt);
                    previous.set(connection.to, { node: currentNode, connection });
                }
            }
        }

        return null; // No se encontró camino
    }

    /**
     * 🔄 Reconstruye el camino desde el resultado de Dijkstra
     */
    reconstructPath(previous, startKey, endKey, totalDistance) {
        const path = [];
        const segments = [];
        let currentKey = endKey;

        while (previous.has(currentKey)) {
            const prev = previous.get(currentKey);
            path.unshift(prev.node);

            if (prev.connection.segment) {
                segments.unshift(prev.connection.segment);
            }

            currentKey = prev.node;
        }

        return {
            nodes: path,
            segments: segments,
            distance: totalDistance
        };
    }

    /**
     * 🛣️ Construye las coordenadas completas de la ruta
     */
    buildCompleteRoute(start, originAccess, path, destAccess, end) {
        const coordinates = [];

        // 1. Punto de inicio
        coordinates.push(start);

        // 2. Línea de acceso al origen
        if (originAccess.distance > 5) { // Solo si está a más de 5m
            coordinates.push(originAccess.coordinates);
        }

        // 3. Recorrer los segmentos del camino
        for (let i = 0; i < path.segments.length; i++) {
            const segment = path.segments[i];

            if (i === 0) {
                // Primer segmento: usar desde el punto de acceso
                const startIdx = this.findClosestCoordinateIndex(segment.coordinates, originAccess.coordinates);
                const segmentCoords = segment.coordinates.slice(startIdx);
                coordinates.push(...segmentCoords);
            } else if (i === path.segments.length - 1) {
                // Último segmento: usar hasta el punto de acceso
                const endIdx = this.findClosestCoordinateIndex(segment.coordinates, destAccess.coordinates);
                const segmentCoords = segment.coordinates.slice(0, endIdx + 1);
                coordinates.push(...segmentCoords);
            } else {
                // Segmentos intermedios: usar completos
                coordinates.push(...segment.coordinates);
            }
        }

        // 4. Línea de acceso al destino
        if (destAccess.distance > 5) { // Solo si está a más de 5m
            coordinates.push(destAccess.coordinates);
        }

        // 5. Punto final
        coordinates.push(end);

        return coordinates;
    }

    /**
     * 📏 Calcula la longitud de un segmento
     */
    calculateSegmentLength(coordinates) {
        let length = 0;
        for (let i = 1; i < coordinates.length; i++) {
            length += this.calculateDistance(
                coordinates[i - 1][0], coordinates[i - 1][1],
                coordinates[i][0], coordinates[i][1]
            );
        }
        return length;
    }

    /**
     * 🌍 Calcula distancia entre dos puntos (Haversine)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * 🔍 Encuentra el índice de la coordenada más cercana
     */
    findClosestCoordinateIndex(coordinates, targetCoord) {
        let minDistance = Infinity;
        let closestIndex = 0;

        coordinates.forEach((coord, index) => {
            const distance = this.calculateDistance(
                coord[0], coord[1],
                targetCoord[0], targetCoord[1]
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        return closestIndex;
    }

    /**
     * 🗺️ Muestra las rutas en el mapa
     */
    displayRoutesOnMap(map, style = {}) {
        if (!this.routeData) return null;

        if (this.routeLayer) {
            map.removeLayer(this.routeLayer);
        }

        const defaultStyle = {
            color: '#FF6B35',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
        };

        this.routeLayer = L.geoJSON(this.routeData, {
            style: { ...defaultStyle, ...style },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    const name = feature.properties.name || 'Ruta personalizada';
                    const desc = feature.properties.description || 'Sendero del campus';

                    layer.bindPopup(`
                        <div style="font-family: sans-serif; font-size: 12px;">
                            <h4 style="margin: 0 0 5px 0; color: #FF6B35;">${name}</h4>
                            <p style="margin: 0; color: #666;">${desc}</p>
                        </div>
                    `);
                }
            }
        }).addTo(map);

        console.log('🗺️ Rutas mostradas en el mapa');
        return this.routeLayer;
    }

    /**
     * 🙈 Oculta las rutas del mapa
     */
    hideRoutesFromMap(map) {
        if (this.routeLayer) {
            map.removeLayer(this.routeLayer);
        }
    }

    /**
     * 📊 Obtiene estadísticas de las rutas
     */
    getRouteStats() {
        if (!this.routeSegments.length) return null;

        const totalLength = this.routeSegments.reduce((sum, segment) => sum + segment.length, 0);

        return {
            totalSegments: this.routeSegments.length,
            totalLength: totalLength,
            averageSegmentLength: totalLength / this.routeSegments.length,
            networkNodes: this.nodeNetwork.size,
            connectedComponents: this.countConnectedComponents()
        };
    }

    /**
     * 🔗 Cuenta componentes conectados en la red
     */
    countConnectedComponents() {
        const visited = new Set();
        let components = 0;

        for (const nodeKey of this.nodeNetwork.keys()) {
            if (!visited.has(nodeKey)) {
                this.dfsVisit(nodeKey, visited);
                components++;
            }
        }

        return components;
    }

    /**
     * 🔍 DFS para contar componentes conectados
     */
    dfsVisit(nodeKey, visited) {
        visited.add(nodeKey);
        const node = this.nodeNetwork.get(nodeKey);

        for (const connection of node.connections) {
            if (!visited.has(connection.to)) {
                this.dfsVisit(connection.to, visited);
            }
        }
    }
}

// 🏭 Funciones para carga automática desde carpeta
export const routeManager = new GeoJSONRouteManager();

/**
 * 📁 Carga automática de archivos GeoJSON desde rutas predefinidas
 */
export const loadPredefinedRoutes = async () => {
    const routeFiles = [
        '/geojson/dataTest.geojson',
    ];

    const availableFiles = [];

    for (const file of routeFiles) {
        try {
            const response = await fetch(file);
            if (response.ok) {
                const data = await response.json();
                availableFiles.push(data);
                console.log(`✅ Cargado: ${file}`);
            }
        } catch (error) {
            console.log(`⚠️ No encontrado: ${file}`);
        }
    }

    if (availableFiles.length > 0) {
        await routeManager.loadRoutesFromFolder(availableFiles);
        return true;
    }

    return false;
};

/**
 * 📂 Carga GeoJSON desde archivos File
 */
export const loadGeoJSONFromFile = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const geoJsonData = JSON.parse(e.target.result);
                resolve(geoJsonData);
            } catch (error) {
                reject(new Error('Error parseando archivo GeoJSON'));
            }
        };
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsText(file);
    });
};