// src/data/buildingsData.js
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import IntelImg from '../assets/Intel.png';
import RectoriaImg from '../assets/Rectoria.png';
import BibliotecaImg from '../assets/Biblioteca.png';
import PidetImg from '../assets/Pidet.png';
import AuditorioImg from '../assets/Auditorio.png';

const IMAGE_MAP = {
    IntelImg,
    RectoriaImg,
    BibliotecaImg,
    PidetImg,
    AuditorioImg
};

// 🔄 Función para cargar edificios con su personal
export const fetchBuildingsWithStaff = async () => {
    try {
        const buildingsSnapshot = await getDocs(collection(db, 'edificio'));
        console.log("📄 Total documentos encontrados:", buildingsSnapshot.docs.length);

        if (buildingsSnapshot.docs.length === 0) {
            console.warn("⚠️ No se encontraron edificios en la colección 'edificios'");
            return [];
        }

        const buildings = await Promise.all(
            buildingsSnapshot.docs.map(async (doc) => {
                const building = doc.data();
                const buildingId = doc.id;


                // Obtener personal del edificio
                const staffSnapshot = await getDocs(
                    query(collection(db, 'personal'), where('academic_division', '==', building.name))
                );

                const staff = staffSnapshot.docs.map((staffDoc) => {
                    const { name, role, shift } = staffDoc.data();
                    return {
                        name,
                        position: role,
                        shift
                    };
                });

                return {
                    id: buildingId,
                    name: building.name,
                    position: typeof building.position === 'string'
                        ? JSON.parse(building.position.replace(/(\w+):/g, '"$1":'))
                        : building.position,
                    image: IMAGE_MAP[building.image] || '',
                    staff
                };
            })
        );


        return buildings;

    } catch (error) {
        console.error("❌ Error al obtener edificios con personal:", error);
        return [];
    }
};
// 🗺️ Configuración del mapa para Leaflet + OSM
export const MAP_CONFIG = {
    center: [20.572976640827633, -100.419786585765], // [lat, lng] para Leaflet
    zoom: 18,
    minZoom: 10,
    maxZoom: 19
};

// 🚗 Configuración específica para OpenRouteService
export const OPENROUTE_CONFIG = {
    // 🔑 API Key de OpenRouteService (GRATIS: 2000 requests/día)
    apiKey: import.meta.env.VITE_OPENROUTE_API_KEY,

    // 🌐 URLs base para diferentes tipos de ruta
    baseUrls: {
        walking: 'https://api.openrouteservice.org/v2/directions/foot-walking',
        cycling: 'https://api.openrouteservice.org/v2/directions/cycling-regular',
        driving: 'https://api.openrouteservice.org/v2/directions/driving-car'
    },

    // ⚙️ Configuraciones por defecto
    defaultProfile: 'walking', // Para campus universitario

    // 📊 Parámetros de la API
    defaultParams: {
        format: 'json',
        geometry_format: 'geojson',
        instructions: 'true',
        units: 'km'
    }
};

// 🗺️ Configuración específica para tiles OSM
export const TILE_CONFIG = {
    // OpenStreetMap estándar (tu elección)
    osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 1
    }
};

// ✅ SE MANTIENE IGUAL: Configuraciones de geolocalización
export const LOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000
};

// 🔧 Función para validar configuración de OpenRouteService
export const validateOpenRouteConfig = () => {
    if (!OPENROUTE_CONFIG.apiKey) {
        console.warn('⚠️ OpenRouteService API key no configurada');
        console.log('📝 Para obtener una API key gratuita:');
        console.log('1. Ir a https://openrouteservice.org/dev/#/signup');
        console.log('2. Registrarse (gratis)');
        console.log('3. Obtener API key (2000 requests/día gratis)');
        console.log('4. Agregar VITE_OPENROUTE_API_KEY=tu_api_key al archivo .env');
        return false;
    }

    console.log('✅ OpenRouteService configurado correctamente');
    return true;
};

// 🎯 Función helper para construir URLs de OpenRouteService
export const buildOpenRouteURL = (start, end, profile = 'walking') => {
    const baseUrl = OPENROUTE_CONFIG.baseUrls[profile];
    const apiKey = OPENROUTE_CONFIG.apiKey;

    if (!apiKey) {
        throw new Error('API key de OpenRouteService no configurada');
    }

    const params = new URLSearchParams({
        api_key: apiKey,
        start: `${start.lng},${start.lat}`,
        end: `${end.lng},${end.lat}`,
        ...OPENROUTE_CONFIG.defaultParams
    });

    return `${baseUrl}?${params.toString()}`;
};