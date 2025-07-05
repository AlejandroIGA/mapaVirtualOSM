// utils/nodeNetworkManager.js - Sistema de rutas basado en nodos
import L from 'leaflet';
import nodeData from '../data/nodeData';

/**
 * Gestor de red de nodos para cálculo de rutas
 * Separado del sistema GeoJSON que solo muestra senderos
 */
export class NodeNetworkManager {
    constructor() {
        this.nodes = new Map();
        this.nodeNetwork = null;
        this.debugMarkers = [];
    }

    /**
     * Cargar red de nodos desde JSON
     */
    async loadNodesFromJSON(nodeData) {
        try {
            this.nodes.clear();

            // Convertir array de nodos a Map para acceso rápido
            nodeData.nodos.forEach(node => {
                this.nodes.set(node.id, {
                    id: node.id,
                    name: node.nombre,
                    lat: node.latitud,
                    lng: node.longitud,
                    neighbors: node.vecinos.map(vecino => ({
                        id: vecino.id_vecino,
                        weight: parseFloat(vecino.peso)
                    }))
                });
            });

            console.log(`✅ Red de nodos cargada: ${this.nodes.size} nodos`);
            this.logNetworkStats();
            return true;

        } catch (error) {
            console.error('❌ Error cargando red de nodos:', error);
            throw error;
        }
    }

    /**
     * Encontrar el nodo más cercano a una coordenada
     */
    findNearestNode(lat, lng, maxDistance = 200) {
        let nearestNode = null;
        let minDistance = maxDistance;

        console.log(`🔍 Buscando nodo más cercano a [${lat}, ${lng}] dentro de ${maxDistance}m...`);

        for (const [nodeId, node] of this.nodes) {
            const distance = this.calculateDistance(lat, lng, node.lat, node.lng);

            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = {
                    ...node,
                    distance: distance
                };
            }
        }

        if (nearestNode) {
            console.log(`✅ Nodo más cercano encontrado: ${nearestNode.name} a ${nearestNode.distance.toFixed(1)}m`);
        } else {
            console.log(`❌ No se encontró ningún nodo dentro de ${maxDistance}m`);
            // Buscar el nodo más cercano sin límite de distancia para debugging
            let closestNode = null;
            let closestDistance = Infinity;
            for (const [nodeId, node] of this.nodes) {
                const distance = this.calculateDistance(lat, lng, node.lat, node.lng);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestNode = { ...node, distance };
                }
            }
            if (closestNode) {
                console.log(`🔍 DEBUG: El nodo más cercano (sin límite) es ${closestNode.name} a ${closestNode.distance.toFixed(1)}m`);
            }
        }

        return nearestNode;
    }

    /**
     * Encontrar nodo por nombre (para edificios específicos)
     */
    findNodeByName(name) {
        for (const [nodeId, node] of this.nodes) {
            if (node.name.toLowerCase().includes(name.toLowerCase())) {
                return node;
            }
        }
        return null;
    }

    /**
     * Obtener nodo específico para un edificio
     */
    getNodeForBuilding(buildingId) {
        // Mapeo específico de edificios a nodos
        const buildingToNodeMap = {
            2: "1751734638651", // División de Tecnologías -> edificio_j
            // Agregar más mapeos según necesites
        };

        const nodeId = buildingToNodeMap[buildingId];
        if (nodeId && this.nodes.has(nodeId)) {
            return this.nodes.get(nodeId);
        }

        return null;
    }

    /**
     * Calcular ruta usando algoritmo de Dijkstra
     */
    calculateRoute(startLat, startLng, endLat, endLng, buildingId = null) {
        console.log(`🧮 Calculando ruta de nodos: [${startLat}, ${startLng}] → [${endLat}, ${endLng}]`);

        // Encontrar nodo de inicio
        const startNode = this.findNearestNode(startLat, startLng, 300);
        if (!startNode) {
            throw new Error('No se encontró nodo de inicio cercano');
        }

        // Encontrar nodo de destino
        let endNode;
        if (buildingId) {
            // Intentar usar nodo específico del edificio primero
            endNode = this.getNodeForBuilding(buildingId);
            if (!endNode) {
                endNode = this.findNearestNode(endLat, endLng, 300);
            }
        } else {
            endNode = this.findNearestNode(endLat, endLng, 300);
        }

        if (!endNode) {
            throw new Error('No se encontró nodo de destino cercano');
        }

        console.log(`📍 Nodos seleccionados: ${startNode.name} → ${endNode.name}`);
        console.log(`📏 Distancias de acceso: ${startNode.distance.toFixed(1)}m → ${endNode.distance.toFixed(1)}m`);

        // Si es el mismo nodo, crear ruta directa
        if (startNode.id === endNode.id) {
            console.log(`ℹ️ Mismo nodo de origen y destino: ${startNode.name}`);
            return this.createDirectRoute(startLat, startLng, endLat, endLng, startNode);
        }

        // Calcular ruta entre nodos usando Dijkstra
        const path = this.dijkstraPath(startNode.id, endNode.id);

        if (!path) {
            throw new Error('No se encontró ruta entre los nodos');
        }

        // Construir coordenadas de la ruta completa
        const routeCoordinates = this.buildRouteCoordinates(
            [startLat, startLng],
            startNode,
            path,
            endNode,
            [endLat, endLng]
        );

        const totalDistance = startNode.distance + path.totalDistance + endNode.distance;
        const estimatedTime = Math.round(totalDistance / 1000 * 12); // 12 min por km caminando

        return {
            coordinates: routeCoordinates,
            distance: totalDistance,
            duration: estimatedTime,
            accessDistance: startNode.distance + endNode.distance,
            routeDistance: path.totalDistance,
            pathNodes: path.nodes,
            source: 'Red de nodos del campus'
        };
    }

    /**
     * Algoritmo de Dijkstra para encontrar la ruta más corta
     */
    dijkstraPath(startNodeId, endNodeId) {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        // Inicializar distancias
        for (const nodeId of this.nodes.keys()) {
            distances.set(nodeId, Infinity);
            unvisited.add(nodeId);
        }
        distances.set(startNodeId, 0);

        while (unvisited.size > 0) {
            // Encontrar nodo no visitado con menor distancia
            let currentNodeId = null;
            let minDistance = Infinity;

            for (const nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    currentNodeId = nodeId;
                }
            }

            if (currentNodeId === null || minDistance === Infinity) {
                break; // No hay más nodos alcanzables
            }

            unvisited.delete(currentNodeId);

            // Si llegamos al destino
            if (currentNodeId === endNodeId) {
                return this.reconstructPath(previous, startNodeId, endNodeId, distances.get(endNodeId));
            }

            // Examinar vecinos
            const currentNode = this.nodes.get(currentNodeId);
            for (const neighbor of currentNode.neighbors) {
                if (!unvisited.has(neighbor.id)) continue;

                const alt = distances.get(currentNodeId) + neighbor.weight;
                if (alt < distances.get(neighbor.id)) {
                    distances.set(neighbor.id, alt);
                    previous.set(neighbor.id, currentNodeId);
                }
            }
        }

        return null; // No se encontró ruta
    }

    /**
     * Reconstruir ruta desde el resultado de Dijkstra
     */
    reconstructPath(previous, startNodeId, endNodeId, totalDistance) {
        const path = [];
        let currentNodeId = endNodeId;

        // Reconstruir camino hacia atrás
        while (currentNodeId !== startNodeId) {
            path.unshift(currentNodeId);
            currentNodeId = previous.get(currentNodeId);
        }
        path.unshift(startNodeId);

        // Convertir IDs a nodos
        const nodes = path.map(nodeId => this.nodes.get(nodeId));

        return {
            nodes: nodes,
            totalDistance: totalDistance,
            nodeIds: path
        };
    }

    /**
     * Crear ruta directa para nodos muy cercanos
     */
    createDirectRoute(startLat, startLng, endLat, endLng, node) {
        const directDistance = this.calculateDistance(startLat, startLng, endLat, endLng);

        return {
            coordinates: [
                [startLat, startLng],
                [node.lat, node.lng],
                [endLat, endLng]
            ],
            distance: directDistance,
            duration: Math.round(directDistance / 1000 * 12),
            accessDistance: node.distance * 2, // Ida y vuelta al nodo
            routeDistance: 0,
            pathNodes: [node],
            source: 'Ruta directa (mismo nodo)'
        };
    }

    /**
     * Construir coordenadas completas de la ruta
     */
    buildRouteCoordinates(start, startNode, path, endNode, end) {
        const coordinates = [];

        // Punto de inicio
        coordinates.push(start);

        // Camino al nodo de inicio (si está lejos)
        if (startNode.distance > 10) {
            coordinates.push([startNode.lat, startNode.lng]);
        }

        // Nodos del camino (excluyendo el primero que ya agregamos)
        for (let i = 1; i < path.nodes.length; i++) {
            const node = path.nodes[i];
            coordinates.push([node.lat, node.lng]);
        }

        // Camino desde el nodo final (si está lejos)
        if (endNode.distance > 10 && endNode.id !== startNode.id) {
            // Solo agregar si no es el mismo nodo que el último del path
            const lastPathNode = path.nodes[path.nodes.length - 1];
            if (lastPathNode.id !== endNode.id) {
                coordinates.push([endNode.lat, endNode.lng]);
            }
        }

        // Punto final
        coordinates.push(end);

        return coordinates;
    }

    /**
     * Calcular distancia entre dos puntos (fórmula de Haversine)
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
     * Mostrar nodos en el mapa para debugging
     */
    showDebugNodes(map, show = true) {
        // Limpiar marcadores existentes
        this.debugMarkers.forEach(marker => {
            map.removeLayer(marker);
        });
        this.debugMarkers = [];

        if (!show) return;

        // Crear marcadores para cada nodo
        for (const [nodeId, node] of this.nodes) {
            const marker = L.circleMarker([node.lat, node.lng], {
                radius: 6,
                fillColor: node.name.includes('edificio') ? '#ff0000' : '#00ff00',
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: sans-serif; font-size: 12px;">
                    <strong>${node.name}</strong><br>
                    ID: ${node.id}<br>
                    Lat: ${node.lat.toFixed(6)}<br>
                    Lng: ${node.lng.toFixed(6)}<br>
                    Vecinos: ${node.neighbors.length}
                </div>
            `);

            this.debugMarkers.push(marker);
        }

        console.log(`🔍 Mostrando ${this.debugMarkers.length} nodos de debug`);
    }

    /**
     * Mostrar conexiones entre nodos
     */
    showDebugConnections(map, show = true) {
        if (!show) return;

        const connectionLines = [];

        for (const [nodeId, node] of this.nodes) {
            for (const neighbor of node.neighbors) {
                const neighborNode = this.nodes.get(neighbor.id);
                if (neighborNode) {
                    const line = L.polyline([
                        [node.lat, node.lng],
                        [neighborNode.lat, neighborNode.lng]
                    ], {
                        color: '#0066cc',
                        weight: 2,
                        opacity: 0.6,
                        dashArray: '5, 5'
                    }).addTo(map);

                    line.bindPopup(`
                        <div style="font-family: sans-serif; font-size: 11px;">
                            ${node.name} → ${neighborNode.name}<br>
                            Distancia: ${neighbor.weight}m
                        </div>
                    `);

                    connectionLines.push(line);
                }
            }
        }

        console.log(`🔗 Mostrando ${connectionLines.length} conexiones`);
        return connectionLines;
    }

    /**
     * Debug: Información detallada de un edificio
     */
    debugBuildingInfo(buildingId, buildingLat, buildingLng) {
        console.log(`🔍 === DEBUG EDIFICIO ID ${buildingId} ===`);
        console.log(`📍 Coordenadas edificio: [${buildingLat}, ${buildingLng}]`);

        // Verificar nodos cercanos
        const nearestNode = this.findNearestNode(buildingLat, buildingLng, 500);
        if (nearestNode) {
            console.log(`🎯 Nodo más cercano: ${nearestNode.name} a ${nearestNode.distance.toFixed(1)}m`);
        } else {
            console.log(`❌ No hay nodos cercanos dentro de 500m`);
        }

        console.log(`🔍 === FIN DEBUG EDIFICIO ===`);
    }

    /**
     * Estadísticas de la red
     */
    logNetworkStats() {
        const totalConnections = Array.from(this.nodes.values())
            .reduce((sum, node) => sum + node.neighbors.length, 0);

        const nodesByType = Array.from(this.nodes.values())
            .reduce((acc, node) => {
                const type = node.name.includes('edificio') ? 'edificios' :
                    node.name.includes('entrada') ? 'entrada' : 'otros';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

        console.log('📊 Estadísticas de la red:');
        console.log(`   • Total nodos: ${this.nodes.size}`);
        console.log(`   • Total conexiones: ${totalConnections}`);
        console.log(`   • Tipos:`, nodesByType);
        console.log(`   • Conectividad promedio: ${(totalConnections / this.nodes.size).toFixed(1)} conexiones/nodo`);
    }

    /**
     * Validar conectividad de la red
     */
    validateNetwork() {
        const visited = new Set();
        const startNodeId = this.nodes.keys().next().value;

        if (!startNodeId) return { connected: false, components: 0 };

        // DFS para marcar nodos visitados
        const dfs = (nodeId) => {
            visited.add(nodeId);
            const node = this.nodes.get(nodeId);

            for (const neighbor of node.neighbors) {
                if (!visited.has(neighbor.id)) {
                    dfs(neighbor.id);
                }
            }
        };

        dfs(startNodeId);

        const connected = visited.size === this.nodes.size;

        console.log(`🔗 Validación de red: ${connected ? 'CONECTADA' : 'DESCONECTADA'}`);
        console.log(`   • Nodos alcanzables: ${visited.size}/${this.nodes.size}`);

        if (!connected) {
            const unreachable = Array.from(this.nodes.keys())
                .filter(id => !visited.has(id))
                .map(id => this.nodes.get(id).name);
            console.log(`   • Nodos no alcanzables:`, unreachable);
        }

        return { connected, reachableNodes: visited.size };
    }
}

// Instancia global del gestor de nodos
export const nodeManager = new NodeNetworkManager();

// Datos de nodos (tu JSON)
export const NODES_DATA = nodeData;

/**
 * Inicializar el sistema de nodos
 */
export const initializeNodeNetwork = async () => {
    try {
        await nodeManager.loadNodesFromJSON(NODES_DATA);

        // Validar la red
        const validation = nodeManager.validateNetwork();

        if (!validation.connected) {
            console.warn('⚠️ La red de nodos no está completamente conectada');
        }

        return true;
    } catch (error) {
        console.error('❌ Error inicializando red de nodos:', error);
        return false;
    }
};