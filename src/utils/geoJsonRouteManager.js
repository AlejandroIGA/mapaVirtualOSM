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
                    }
                } catch (error) {
                    console.warn(`Error cargando archivo:`, error);
                }
            }

            this.routeData = {
                type: "FeatureCollection",
                features: allFeatures
            };

            return true;

        } catch (error) {
            console.error('Error cargando rutas:', error);
            throw error;
        }
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
            }
        } catch (error) {
        }
    }

    if (availableFiles.length > 0) {
        await routeManager.loadRoutesFromFolder(availableFiles);
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