// utils/geoJsonRouteManager.js - CON DEBUG DETALLADO
import L from 'leaflet';

export class WeightedGeoJSONRouteManager {
    constructor() {
        this.routeData = null;
        this.routeLayer = null;
        this.nodeGraph = new Map();
        this.nodePositions = new Map();
        this.routeSegments = [];
        this.debugMode = true; // ACTIVADO para diagnosticar
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
                        console.log(`📄 Archivo cargado: ${geoJsonData.features.length} features`);
                    }
                } catch (error) {
                    console.warn(`Error cargando archivo:`, error);
                }
            }

            this.routeData = {
                type: "FeatureCollection",
                features: allFeatures
            };

            console.log(`📊 TOTAL FEATURES CARGADAS: ${allFeatures.length}`);
            allFeatures.forEach((feature, idx) => {
                console.log(`Feature ${idx}: ${feature.properties?.name || 'Sin nombre'} - ${feature.geometry?.coordinates?.length || 0} puntos`);
            });

            this.buildWeightedNodeGraph();
            return true;

        } catch (error) {
            console.error('Error cargando rutas:', error);
            throw error;
        }
    }

    buildWeightedNodeGraph() {
        console.log('🔧 === CONSTRUYENDO GRAFO CON PESOS ===');

        this.nodeGraph.clear();
        this.nodePositions.clear();
        this.routeSegments = [];

        // Procesar cada segmento del GeoJSON
        this.routeData.features.forEach((feature, segmentIndex) => {
            if (feature.geometry && feature.geometry.type === 'LineString') {
                this.processSegmentWithWeights(feature, segmentIndex);
            }
        });

        // Conectar nodos que están en la misma posición
        this.connectCoincidentNodes();

        console.log(`✅ === GRAFO CONSTRUIDO ===`);
        console.log(`   📍 ${this.nodePositions.size} nodos únicos`);
        console.log(`   🔗 ${this.getTotalConnections()} conexiones con pesos`);
        console.log(`   📏 ${this.routeSegments.length} segmentos procesados`);

        if (this.debugMode) {
            this.printGraphDebugInfo();
        }
    }

    processSegmentWithWeights(feature, segmentIndex) {
        const coordinates = feature.geometry.coordinates;
        const leafletCoords = coordinates.map(coord => [coord[1], coord[0]]);
        const segmentName = feature.properties?.name || `Segmento_${segmentIndex}`;

        const segment = {
            id: segmentIndex,
            name: segmentName,
            coordinates: leafletCoords,
            originalCoords: coordinates,
            properties: feature.properties || {}
        };
        this.routeSegments.push(segment);

        console.log(`📏 === PROCESANDO SEGMENTO: ${segmentName} ===`);
        console.log(`   📊 ${leafletCoords.length} puntos en el segmento`);

        // Crear nodos para cada punto del segmento y calcular pesos
        for (let i = 0; i < leafletCoords.length; i++) {
            const currentPoint = leafletCoords[i];
            const nodeId = this.createNodeId(currentPoint);

            // Registrar posición del nodo
            if (!this.nodePositions.has(nodeId)) {
                this.nodePositions.set(nodeId, {
                    lat: currentPoint[0],
                    lng: currentPoint[1],
                    segments: [segmentIndex]
                });
                console.log(`   📍 Nuevo nodo: ${nodeId} [${currentPoint[0].toFixed(6)}, ${currentPoint[1].toFixed(6)}]`);
            } else {
                // Nodo ya existe, agregar este segmento
                this.nodePositions.get(nodeId).segments.push(segmentIndex);
                console.log(`   📍 Nodo existente: ${nodeId} - agregado segmento ${segmentIndex}`);
            }

            // Crear nodo en el grafo si no existe
            if (!this.nodeGraph.has(nodeId)) {
                this.nodeGraph.set(nodeId, new Map());
            }

            // Conectar con el siguiente punto en el segmento (si existe)
            if (i < leafletCoords.length - 1) {
                const nextPoint = leafletCoords[i + 1];
                const nextNodeId = this.createNodeId(nextPoint);
                const distance = this.calculateDistance(
                    currentPoint[0], currentPoint[1],
                    nextPoint[0], nextPoint[1]
                );

                // Agregar conexión bidireccional con peso (distancia)
                this.addWeightedConnection(nodeId, nextNodeId, distance, segmentIndex, segmentName);
                this.addWeightedConnection(nextNodeId, nodeId, distance, segmentIndex, segmentName);

                console.log(`     🔗 ${nodeId} ↔ ${nextNodeId}: ${distance.toFixed(1)}m`);
            }
        }
    }

    addWeightedConnection(fromNodeId, toNodeId, weight, segmentId, segmentName) {
        if (!this.nodeGraph.has(fromNodeId)) {
            this.nodeGraph.set(fromNodeId, new Map());
        }

        const connections = this.nodeGraph.get(fromNodeId);

        // Solo agregar si no existe o si es mejor peso
        if (!connections.has(toNodeId) || connections.get(toNodeId).weight > weight) {
            connections.set(toNodeId, {
                weight: weight,
                segmentId: segmentId,
                segmentName: segmentName,
                type: 'segment'
            });
        }
    }

    connectCoincidentNodes() {
        const tolerance = 0.000001; // ~0.1 metros
        const nodeIds = Array.from(this.nodePositions.keys());
        let connectionsCreated = 0;

        console.log('🔗 === CONECTANDO NODOS COINCIDENTES ===');

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const nodeA = nodeIds[i];
                const nodeB = nodeIds[j];
                const posA = this.nodePositions.get(nodeA);
                const posB = this.nodePositions.get(nodeB);

                const distance = this.calculateDistance(posA.lat, posA.lng, posB.lat, posB.lng);

                if (distance <= tolerance) {
                    // Verificar que no compartan el mismo segmento
                    const shareSegment = posA.segments.some(seg => posB.segments.includes(seg));

                    if (!shareSegment) {
                        // Conectar con peso cero (están en la misma posición)
                        this.addWeightedConnection(nodeA, nodeB, 0, null, 'Conexión_Virtual');
                        this.addWeightedConnection(nodeB, nodeA, 0, null, 'Conexión_Virtual');
                        connectionsCreated++;
                        console.log(`🔗 Nodos coincidentes: ${nodeA} ↔ ${nodeB} (distancia: ${distance.toFixed(8)}m)`);
                    }
                }
            }
        }

        console.log(`✅ ${connectionsCreated} conexiones virtuales creadas`);
    }

    createNodeId(coordinate, precision = 6) {
        return `${coordinate[0].toFixed(precision)},${coordinate[1].toFixed(precision)}`;
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // 🎯 FUNCIÓN PRINCIPAL CON DEBUG DETALLADO
    calculateCustomRoute(originLat, originLng, destLat, destLng) {
        console.log('\n🧮 === INICIANDO CÁLCULO DE RUTA CON DEBUG ===');
        console.log(`📍 Origen solicitado: [${originLat}, ${originLng}]`);
        console.log(`🎯 Destino solicitado: [${destLat}, destLng]`);
        console.log(`📊 Estado del grafo:`);
        console.log(`   - Nodos disponibles: ${this.nodePositions.size}`);
        console.log(`   - Conexiones totales: ${this.getTotalConnections()}`);
        console.log(`   - Segmentos cargados: ${this.routeSegments.length}`);

        // 1. Verificar que el grafo esté construido
        if (this.nodePositions.size === 0) {
            console.log('❌ ERROR: No hay nodos en el grafo');
            return null;
        }

        // 2. Encontrar nodos más cercanos al origen y destino
        console.log('\n🔍 === BUSCANDO NODOS MÁS CERCANOS ===');
        const originNode = this.findNearestNode(originLat, originLng, 200); // Aumentar rango de búsqueda
        const destNode = this.findNearestNode(destLat, destLng, 200);

        console.log(`📍 Resultado búsqueda de nodo origen:`);
        if (originNode) {
            console.log(`   ✅ Nodo encontrado: ${originNode.nodeId}`);
            console.log(`   📏 Distancia: ${originNode.distance.toFixed(1)}m`);
            console.log(`   📍 Posición nodo: [${originNode.position.lat}, ${originNode.position.lng}]`);
        } else {
            console.log(`   ❌ NO se encontró nodo cercano al origen`);
            console.log(`   🔍 Nodos disponibles en el área:`);
            this.listNearbyNodes(originLat, originLng, 500);
            return null;
        }

        console.log(`🎯 Resultado búsqueda de nodo destino:`);
        if (destNode) {
            console.log(`   ✅ Nodo encontrado: ${destNode.nodeId}`);
            console.log(`   📏 Distancia: ${destNode.distance.toFixed(1)}m`);
            console.log(`   📍 Posición nodo: [${destNode.position.lat}, ${destNode.position.lng}]`);
        } else {
            console.log(`   ❌ NO se encontró nodo cercano al destino`);
            console.log(`   🔍 Nodos disponibles en el área:`);
            this.listNearbyNodes(destLat, destLng, 500);
            return null;
        }

        // 3. Verificar conectividad entre nodos
        console.log('\n🗺️ === VERIFICANDO CONECTIVIDAD ===');
        console.log(`🔗 Conexiones desde nodo origen (${originNode.nodeId}):`);
        const originConnections = this.nodeGraph.get(originNode.nodeId);
        if (originConnections && originConnections.size > 0) {
            for (const [targetId, connection] of originConnections) {
                console.log(`   → ${targetId}: ${connection.weight.toFixed(1)}m (${connection.segmentName})`);
            }
        } else {
            console.log(`   ❌ Nodo origen NO tiene conexiones`);
            return null;
        }

        console.log(`🔗 Conexiones desde nodo destino (${destNode.nodeId}):`);
        const destConnections = this.nodeGraph.get(destNode.nodeId);
        if (destConnections && destConnections.size > 0) {
            for (const [targetId, connection] of destConnections) {
                console.log(`   → ${targetId}: ${connection.weight.toFixed(1)}m (${connection.segmentName})`);
            }
        } else {
            console.log(`   ❌ Nodo destino NO tiene conexiones`);
            return null;
        }

        // 4. Usar Dijkstra con pesos precalculados
        console.log('\n🧮 === EJECUTANDO ALGORITMO DIJKSTRA ===');
        const shortestPath = this.dijkstraWeighted(originNode.nodeId, destNode.nodeId);

        if (!shortestPath) {
            console.log('❌ ERROR: Dijkstra no encontró ruta');
            console.log('🔍 Verificando conectividad del grafo...');
            this.analyzeConnectivity();
            return null;
        }

        // 5. Construir coordenadas de la ruta completa
        console.log('\n🛠️ === CONSTRUYENDO RUTA FINAL ===');
        const routeCoordinates = this.buildRouteCoordinates(
            [originLat, originLng],
            originNode,
            shortestPath,
            destNode,
            [destLat, destLng]
        );

        const totalDistance = originNode.distance + shortestPath.totalWeight + destNode.distance;

        console.log(`✅ === RUTA CALCULADA EXITOSAMENTE ===`);
        console.log(`   📏 Distancia total: ${totalDistance.toFixed(0)}m`);
        console.log(`   📊 Nodos en la ruta: ${shortestPath.path.length}`);
        console.log(`   🛤️ Segmentos utilizados: ${shortestPath.segmentsUsed.size}`);
        console.log(`   📍 Coordenadas finales: ${routeCoordinates.length} puntos`);

        return {
            coordinates: routeCoordinates,
            distance: totalDistance,
            path: shortestPath.path,
            segmentsUsed: Array.from(shortestPath.segmentsUsed),
            useCustomRoutes: true,
            accessDistance: originNode.distance + destNode.distance,
            routeDistance: shortestPath.totalWeight
        };
    }

    // Función auxiliar para listar nodos cercanos
    listNearbyNodes(lat, lng, radius) {
        console.log(`   📍 Buscando nodos dentro de ${radius}m de [${lat}, ${lng}]:`);
        let found = 0;
        for (const [nodeId, position] of this.nodePositions) {
            const distance = this.calculateDistance(lat, lng, position.lat, position.lng);
            if (distance <= radius) {
                console.log(`     ${nodeId}: ${distance.toFixed(1)}m - Segmentos: [${position.segments.join(', ')}]`);
                found++;
            }
        }
        if (found === 0) {
            console.log(`     ❌ No se encontraron nodos dentro de ${radius}m`);
        } else {
            console.log(`     ✅ ${found} nodos encontrados en el área`);
        }
    }

    // Función para analizar conectividad del grafo
    analyzeConnectivity() {
        console.log('\n🔍 === ANÁLISIS DE CONECTIVIDAD ===');

        // Contar componentes conectados
        const visited = new Set();
        let components = 0;
        const componentSizes = [];

        for (const nodeId of this.nodeGraph.keys()) {
            if (!visited.has(nodeId)) {
                const componentSize = this.dfsComponentSize(nodeId, visited);
                components++;
                componentSizes.push(componentSize);
                console.log(`   Componente ${components}: ${componentSize} nodos`);
            }
        }

        console.log(`📊 Resumen de conectividad:`);
        console.log(`   - Componentes conectados: ${components}`);
        console.log(`   - Componente más grande: ${Math.max(...componentSizes)} nodos`);

        if (components > 1) {
            console.log(`   ⚠️ PROBLEMA: El grafo está fragmentado en ${components} partes`);
            console.log(`   💡 SOLUCIÓN: Verificar que los segmentos del GeoJSON se conecten correctamente`);
        }
    }

    dfsComponentSize(startNode, visited) {
        const stack = [startNode];
        let size = 0;

        while (stack.length > 0) {
            const currentNode = stack.pop();
            if (visited.has(currentNode)) continue;

            visited.add(currentNode);
            size++;

            const connections = this.nodeGraph.get(currentNode);
            if (connections) {
                for (const neighborId of connections.keys()) {
                    if (!visited.has(neighborId)) {
                        stack.push(neighborId);
                    }
                }
            }
        }

        return size;
    }

    findNearestNode(lat, lng, maxDistance = 200) {
        let nearestNode = null;
        let minDistance = maxDistance;

        console.log(`   🔍 Buscando nodo más cercano a [${lat}, ${lng}] (radio: ${maxDistance}m)`);

        for (const [nodeId, position] of this.nodePositions) {
            const distance = this.calculateDistance(lat, lng, position.lat, position.lng);

            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = {
                    nodeId: nodeId,
                    position: position,
                    distance: distance
                };
            }
        }

        if (nearestNode) {
            console.log(`   ✅ Nodo más cercano: ${nearestNode.nodeId} a ${nearestNode.distance.toFixed(1)}m`);
        } else {
            console.log(`   ❌ No se encontró nodo dentro de ${maxDistance}m`);
        }

        return nearestNode;
    }

    dijkstraWeighted(startNodeId, endNodeId) {
        console.log(`🧮 Ejecutando Dijkstra: ${startNodeId} → ${endNodeId}`);

        const distances = new Map();
        const previous = new Map();
        const visited = new Set();
        const segmentsUsed = new Set();

        // Inicializar distancias
        for (const nodeId of this.nodeGraph.keys()) {
            distances.set(nodeId, Infinity);
        }
        distances.set(startNodeId, 0);

        let iterations = 0;
        const maxIterations = this.nodeGraph.size * 2; // Protección contra bucles infinitos

        while (iterations < maxIterations) {
            iterations++;

            // Encontrar nodo no visitado con menor distancia
            let currentNode = null;
            let minDistance = Infinity;

            for (const [nodeId, distance] of distances) {
                if (!visited.has(nodeId) && distance < minDistance) {
                    minDistance = distance;
                    currentNode = nodeId;
                }
            }

            if (currentNode === null || minDistance === Infinity) {
                console.log(`   ⚠️ No hay más nodos alcanzables (iteración ${iterations})`);
                break;
            }

            visited.add(currentNode);
            console.log(`   🔄 Iteración ${iterations}: Visitando ${currentNode} (dist: ${minDistance.toFixed(1)}m)`);

            // Si llegamos al destino
            if (currentNode === endNodeId) {
                const path = this.reconstructPath(previous, startNodeId, endNodeId, segmentsUsed);
                console.log(`   ✅ Ruta encontrada en ${iterations} iteraciones`);
                console.log(`   📏 Distancia total: ${minDistance.toFixed(1)}m`);
                console.log(`   📊 Nodos en ruta: ${path.length}`);

                return {
                    path: path,
                    totalWeight: minDistance,
                    segmentsUsed: segmentsUsed
                };
            }

            // Examinar vecinos del nodo actual
            const connections = this.nodeGraph.get(currentNode);
            if (connections) {
                for (const [neighborId, connectionInfo] of connections) {
                    if (visited.has(neighborId)) continue;

                    const newDistance = distances.get(currentNode) + connectionInfo.weight;

                    if (newDistance < distances.get(neighborId)) {
                        distances.set(neighborId, newDistance);
                        previous.set(neighborId, {
                            nodeId: currentNode,
                            segmentId: connectionInfo.segmentId,
                            segmentName: connectionInfo.segmentName
                        });
                        console.log(`     📍 Actualizado ${neighborId}: ${newDistance.toFixed(1)}m via ${connectionInfo.segmentName}`);
                    }
                }
            }
        }

        console.log(`   ❌ No se encontró ruta después de ${iterations} iteraciones`);
        return null;
    }

    reconstructPath(previous, startNodeId, endNodeId, segmentsUsed) {
        const path = [];
        let currentNodeId = endNodeId;

        while (currentNodeId !== startNodeId) {
            path.unshift(currentNodeId);
            const prevInfo = previous.get(currentNodeId);

            if (prevInfo && prevInfo.segmentId !== null) {
                segmentsUsed.add(prevInfo.segmentId);
            }

            currentNodeId = prevInfo.nodeId;
        }

        path.unshift(startNodeId);
        return path;
    }

    buildRouteCoordinates(originCoord, originNode, shortestPath, destNode, destCoord) {
        const coordinates = [];

        // 1. Punto de inicio
        coordinates.push(originCoord);

        // 2. Punto de acceso al grafo (si está lejos)
        if (originNode.distance > 5) {
            const originPos = this.nodePositions.get(originNode.nodeId);
            coordinates.push([originPos.lat, originPos.lng]);
        }

        // 3. Nodos del camino calculado
        for (const nodeId of shortestPath.path) {
            const nodePos = this.nodePositions.get(nodeId);
            if (nodePos) {
                coordinates.push([nodePos.lat, nodePos.lng]);
            }
        }

        // 4. Punto de salida del grafo (si está lejos)
        if (destNode.distance > 5) {
            const destPos = this.nodePositions.get(destNode.nodeId);
            coordinates.push([destPos.lat, destPos.lng]);
        }

        // 5. Punto final
        coordinates.push(destCoord);

        return coordinates;
    }

    getTotalConnections() {
        let total = 0;
        for (const connections of this.nodeGraph.values()) {
            total += connections.size;
        }
        return total;
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

    printGraphDebugInfo() {
        console.log('\n🔍 === DEBUG: INFORMACIÓN COMPLETA DEL GRAFO ===');

        console.log(`📊 Estadísticas generales:`);
        console.log(`   - Total nodos: ${this.nodePositions.size}`);
        console.log(`   - Total conexiones: ${this.getTotalConnections()}`);
        console.log(`   - Total segmentos: ${this.routeSegments.length}`);

        console.log(`\n📍 Lista de todos los nodos:`);
        for (const [nodeId, position] of this.nodePositions) {
            const connections = this.nodeGraph.get(nodeId);
            console.log(`${nodeId}: [${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}] - ${connections?.size || 0} conexiones - Segmentos: [${position.segments.join(', ')}]`);
        }
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            this.printGraphDebugInfo();
        }
    }

    getGraphStats() {
        const totalNodes = this.nodePositions.size;
        const totalConnections = this.getTotalConnections();
        const segmentCount = this.routeSegments.length;

        const allWeights = [];
        for (const connections of this.nodeGraph.values()) {
            for (const connectionInfo of connections.values()) {
                allWeights.push(connectionInfo.weight);
            }
        }

        const avgWeight = allWeights.length > 0 ?
            allWeights.reduce((sum, w) => sum + w, 0) / allWeights.length : 0;

        return {
            totalNodes,
            totalConnections,
            segmentCount,
            averageWeight: avgWeight,
            maxWeight: Math.max(...allWeights, 0),
            minWeight: Math.min(...allWeights, 0)
        };
    }
}

// Instancia global
export const routeManager = new WeightedGeoJSONRouteManager();

// Función para cargar rutas predefinidas
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
                console.log(`✅ Archivo GeoJSON cargado: ${file}`);
            }
        } catch (error) {
            console.log(`❌ No se pudo cargar: ${file}`);
        }
    }

    if (availableFiles.length > 0) {
        await routeManager.loadRoutesFromFolder(availableFiles);

        const stats = routeManager.getGraphStats();
        console.log('📊 === ESTADÍSTICAS FINALES DEL GRAFO ===');
        console.log(`   📍 ${stats.totalNodes} nodos`);
        console.log(`   🔗 ${stats.totalConnections} conexiones`);
        console.log(`   📏 Peso promedio: ${stats.averageWeight.toFixed(1)}m`);
        console.log(`   📐 Rango de pesos: ${stats.minWeight.toFixed(1)}m - ${stats.maxWeight.toFixed(1)}m`);

        return true;
    }

    console.log('❌ No se pudieron cargar archivos GeoJSON');
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