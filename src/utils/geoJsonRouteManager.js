// utils/geoJsonRouteManager.js - Versión corregida
import L from 'leaflet';

export class GeoJSONRouteManager {
    constructor() {
        this.routeData = null;
        this.routeLayer = null;
        this.routeSegments = [];
        this.nodeNetwork = new Map();
        this.spatialIndex = [];
    }

    async loadRoutesFromFolder(geoJsonFiles) {
        try {
            const allFeatures = [];

            for (const file of geoJsonFiles) {
                try {
                    let geoJsonData;

                    if (typeof file === 'string') {
                        const response = await fetch(file);
                        if (!response.ok) continue;
                        geoJsonData = await response.json();
                    } else {
                        geoJsonData = file;
                    }

                    if (geoJsonData.features) {
                        allFeatures.push(...geoJsonData.features);
                    }
                } catch (error) {
                    console.warn(`Error cargando archivo:`, error);
                }
            }

            this.routeData = {
                type: "FeatureCollection",
                features: allFeatures
            };

            this.processAdvancedRouteNetwork();
            return true;

        } catch (error) {
            console.error('Error cargando rutas:', error);
            throw error;
        }
    }

    processAdvancedRouteNetwork() {
        if (!this.routeData || !this.routeData.features) {
            throw new Error('Datos GeoJSON inválidos');
        }

        this.routeSegments = [];
        this.nodeNetwork.clear();
        this.spatialIndex = [];

        // Procesar segmentos
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

        // Solo conectar nodos que realmente deberían estar conectados
        this.connectValidNodes();

        console.log(`✅ Red procesada: ${this.routeSegments.length} segmentos, ${this.nodeNetwork.size} nodos`);
    }

    createNodeKey(coord, precision = 6) {
        // Aumentar precisión para evitar conexiones incorrectas
        return `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
    }

    addSegmentToSpatialIndex(segment) {
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

    addSegmentToNetwork(segment) {
        const startKey = segment.startNode;
        const endKey = segment.endNode;

        // Crear nodos si no existen
        if (!this.nodeNetwork.has(startKey)) {
            this.nodeNetwork.set(startKey, {
                coordinates: segment.coordinates[0],
                connections: [],
                segments: [] // Agregar lista de segmentos conectados
            });
        }

        if (!this.nodeNetwork.has(endKey)) {
            this.nodeNetwork.set(endKey, {
                coordinates: segment.coordinates[segment.coordinates.length - 1],
                connections: [],
                segments: []
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

        // Agregar referencia del segmento
        this.nodeNetwork.get(startKey).segments.push(segment.id);
        this.nodeNetwork.get(endKey).segments.push(segment.id);
    }

    // FUNCIÓN CORREGIDA: Solo conectar nodos que realmente deberían estar conectados
    connectValidNodes() {
        const tolerance = 10; // Reducir tolerancia drásticamente (10 metros)
        const nodes = Array.from(this.nodeNetwork.entries());

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const [keyA, nodeA] = nodes[i];
                const [keyB, nodeB] = nodes[j];

                const distance = this.calculateDistance(
                    nodeA.coordinates[0], nodeA.coordinates[1],
                    nodeB.coordinates[0], nodeB.coordinates[1]
                );

                // Solo conectar si están muy cerca Y no comparten segmentos
                if (distance <= tolerance) {
                    const shareSegments = this.nodesShareSegments(nodeA, nodeB);
                    const alreadyConnected = nodeA.connections.some(conn => conn.to === keyB);

                    // Solo conectar si NO comparten segmentos y NO están ya conectados
                    if (!shareSegments && !alreadyConnected) {
                        // Verificar que la conexión tenga sentido geográficamente
                        if (this.isValidConnection(nodeA, nodeB, distance)) {
                            nodeA.connections.push({
                                to: keyB,
                                segment: null,
                                distance: distance,
                                direction: 'virtual'
                            });

                            nodeB.connections.push({
                                to: keyA,
                                segment: null,
                                distance: distance,
                                direction: 'virtual'
                            });

                            console.log(`🔗 Conexión virtual creada: ${distance.toFixed(1)}m`);
                        }
                    }
                }
            }
        }
    }

    // Nueva función: Verificar si dos nodos comparten segmentos
    nodesShareSegments(nodeA, nodeB) {
        return nodeA.segments.some(segmentId => nodeB.segments.includes(segmentId));
    }

    // Nueva función: Validar si una conexión tiene sentido
    isValidConnection(nodeA, nodeB, distance) {
        // No crear conexiones si están demasiado lejos
        if (distance > 15) return false;

        // Verificar que no haya obstáculos obvios (esto se puede expandir)
        const midPoint = [
            (nodeA.coordinates[0] + nodeB.coordinates[0]) / 2,
            (nodeA.coordinates[1] + nodeB.coordinates[1]) / 2
        ];

        // Por ahora, permitir conexiones cortas
        return distance <= 15;
    }

    findNearestRoutePointOptimized(targetLat, targetLng, maxDistance = 100) {
        let nearestPoint = null;
        let minDistance = maxDistance;

        const margin = 0.001; // Reducir margen de búsqueda
        const candidateSegments = this.spatialIndex.filter(bbox => {
            return targetLat >= (bbox.minLat - margin) &&
                targetLat <= (bbox.maxLat + margin) &&
                targetLng >= (bbox.minLng - margin) &&
                targetLng <= (bbox.maxLng + margin);
        }).map(bbox => bbox.segment);

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

    calculateCustomRoute(originLat, originLng, destLat, destLng) {
        console.log(`🧮 Calculando ruta personalizada desde [${originLat}, ${originLng}] a [${destLat}, ${destLng}]`);

        const nearestOrigin = this.findNearestRoutePointOptimized(originLat, originLng, 150);
        const nearestDest = this.findNearestRoutePointOptimized(destLat, destLng, 150);

        if (!nearestOrigin) {
            console.log('❌ No se encontró punto de origen cercano a las rutas');
            return null;
        }

        if (!nearestDest) {
            console.log('❌ No se encontró punto de destino cercano a las rutas');
            return null;
        }

        console.log(`📍 Origen: ${nearestOrigin.distance.toFixed(1)}m de la ruta más cercana`);
        console.log(`📍 Destino: ${nearestDest.distance.toFixed(1)}m de la ruta más cercana`);

        // Si ambos puntos están en el mismo segmento
        if (nearestOrigin.segment.id === nearestDest.segment.id) {
            console.log('✅ Ambos puntos en el mismo segmento');

            const segment = nearestOrigin.segment;
            const originIdx = this.findClosestCoordinateIndex(segment.coordinates, nearestOrigin.coordinates);
            const destIdx = this.findClosestCoordinateIndex(segment.coordinates, nearestDest.coordinates);

            const startIdx = Math.min(originIdx, destIdx);
            const endIdx = Math.max(originIdx, destIdx);

            const pathCoords = segment.coordinates.slice(startIdx, endIdx + 1);

            const routeCoordinates = [
                [originLat, originLng],
                nearestOrigin.coordinates,
                ...pathCoords,
                nearestDest.coordinates,
                [destLat, destLng]
            ];

            const totalDistance = nearestOrigin.distance + nearestDest.distance +
                this.calculateSegmentLength(pathCoords);

            return {
                coordinates: routeCoordinates,
                distance: totalDistance,
                segments: [nearestOrigin.segment],
                useCustomRoutes: true,
                accessDistance: nearestOrigin.distance + nearestDest.distance,
                routeDistance: totalDistance - (nearestOrigin.distance + nearestDest.distance)
            };
        }

        // Buscar ruta entre diferentes segmentos
        const originNode = this.findNearestNode(nearestOrigin.coordinates);
        const destNode = this.findNearestNode(nearestDest.coordinates);

        if (!originNode || !destNode) {
            console.log('❌ No se encontraron nodos cercanos para la ruta');
            return null;
        }

        console.log(`🔍 Buscando ruta entre nodos: ${originNode.distance.toFixed(1)}m → ${destNode.distance.toFixed(1)}m`);

        const path = this.dijkstraPath(originNode.key, destNode.key);

        if (!path || path.length === 0) {
            console.log('❌ No se encontró ruta válida entre los nodos');
            return null;
        }

        const routeCoordinates = this.buildCompleteRoute(
            [originLat, originLng],
            nearestOrigin,
            path,
            nearestDest,
            [destLat, destLng]
        );

        const totalDistance = nearestOrigin.distance + path.distance + nearestDest.distance;

        console.log(`✅ Ruta calculada: ${totalDistance.toFixed(0)}m total`);

        return {
            coordinates: routeCoordinates,
            distance: totalDistance,
            segments: path.segments,
            useCustomRoutes: true,
            accessDistance: nearestOrigin.distance + nearestDest.distance,
            routeDistance: path.distance
        };
    }

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
                console.log('⚠️ No hay más nodos alcanzables');
                break;
            }

            unvisited.delete(currentNode);

            // Si llegamos al destino
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

        return null;
    }

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

    buildCompleteRoute(start, originAccess, path, destAccess, end) {
        const coordinates = [];

        // Punto de inicio
        coordinates.push(start);

        // Acceso al punto de origen en la ruta
        if (originAccess.distance > 5) {
            coordinates.push(originAccess.coordinates);
        }

        // Segmentos de la ruta principal
        for (let i = 0; i < path.segments.length; i++) {
            const segment = path.segments[i];

            // Evitar duplicar coordenadas en las uniones
            const lastCoord = coordinates[coordinates.length - 1];
            let segmentCoords = [...segment.coordinates];

            // Si el primer punto del segmento está muy cerca del último punto agregado, omitirlo
            if (segmentCoords.length > 0) {
                const firstPoint = segmentCoords[0];
                const distance = this.calculateDistance(lastCoord[0], lastCoord[1], firstPoint[0], firstPoint[1]);
                if (distance < 5) {
                    segmentCoords = segmentCoords.slice(1);
                }
            }

            coordinates.push(...segmentCoords);
        }

        // Acceso al punto de destino
        if (destAccess.distance > 5) {
            coordinates.push(destAccess.coordinates);
        }

        // Punto final
        coordinates.push(end);

        return coordinates;
    }

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

        return this.routeLayer;
    }

    hideRoutesFromMap(map) {
        if (this.routeLayer) {
            map.removeLayer(this.routeLayer);
        }
    }

    // Función de debug para visualizar conexiones
    showDebugConnections(map) {
        const debugLines = [];

        for (const [nodeKey, node] of this.nodeNetwork) {
            for (const connection of node.connections) {
                if (connection.direction === 'virtual') {
                    const targetNode = this.nodeNetwork.get(connection.to);
                    if (targetNode) {
                        const line = L.polyline([
                            node.coordinates,
                            targetNode.coordinates
                        ], {
                            color: 'red',
                            weight: 2,
                            opacity: 0.7,
                            dashArray: '3, 3'
                        }).addTo(map);

                        debugLines.push(line);
                    }
                }
            }
        }

        console.log(`🔍 Mostrando ${debugLines.length} conexiones virtuales`);
        return debugLines;
    }

    getRouteStats() {
        if (!this.routeSegments.length) return null;

        const totalLength = this.routeSegments.reduce((sum, segment) => sum + segment.length, 0);
        const virtualConnections = Array.from(this.nodeNetwork.values())
            .reduce((count, node) => count + node.connections.filter(c => c.direction === 'virtual').length, 0);

        return {
            totalSegments: this.routeSegments.length,
            totalLength: totalLength,
            averageSegmentLength: totalLength / this.routeSegments.length,
            networkNodes: this.nodeNetwork.size,
            virtualConnections: virtualConnections,
            connectedComponents: this.countConnectedComponents()
        };
    }

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

export const routeManager = new GeoJSONRouteManager();

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
            }
        } catch (error) {
            // Archivo no encontrado, continuar
        }
    }

    if (availableFiles.length > 0) {
        await routeManager.loadRoutesFromFolder(availableFiles);
        console.log('📊 Estadísticas de rutas:', routeManager.getRouteStats());
        return true;
    }

    return false;
};

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