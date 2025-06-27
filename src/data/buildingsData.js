// data/buildingsData.js - Configuración actualizada
import IntelImg from '../assets/Intel.png';
import RectoriaImg from '../assets/Rectoria.png';
import BibliotecaImg from '../assets/Biblioteca.png';
import PidetImg from '../assets/Pidet.png';
import AuditorioImg from '../assets/Auditorio.png';

// ✅ LOS DATOS DE EDIFICIOS NO CAMBIAN
export const BUILDINGS_DATA = [
    {
        id: 1,
        name: "Biblioteca Central",
        position: { lat: 20.654832, lng: -100.403785 },
        image: BibliotecaImg,
        staff: [
            { name: "María González", position: "Bibliotecaria Jefe", phone: "442-123-4567" },
            { name: "Carlos Pérez", position: "Asistente", phone: "442-123-4568" }
        ]
    },
    {
        id: 2,
        name: "División de Tecnologías de Automatización e Información ",
        position: { lat: 20.65431008251582, lng: -100.40458595617194 },
        staff: [
            { name: "José Gonzalo Lugo Pérez", position: "Director", phone: "442-123-4569" },
            { name: "Ing. Roberto Silva", position: "Coordinador", phone: "442-123-4570" }
        ]
    },
    {
        id: 3,
        name: "Rectoría",
        position: { lat: 20.6543236, lng: -100.4055099 },
        image: RectoriaImg,
        staff: [
            { name: "Dr. Luis Fernando Pantoja Amaro", position: "Rector", phone: "442-123-4571" },
            { name: "Dr. José Cabello Gil", position: "Secretario", phone: "442-123-4572" }
        ]
    },
    {
        id: 4,
        name: "Auditorio",
        position: { lat: 20.655972, lng: -100.405477 },
        image: AuditorioImg,
        staff: [
            { name: "Mtra. Laura Hernández", position: "Coordinadora de Eventos", phone: "442-321-7890" },
            { name: "Ing. Carlos Ramírez", position: "Técnico de Soporte", phone: "442-321-7891" }
        ]
    },
    {
        id: 5,
        name: "Creativity and Innovation Center 4.0 CIC 4.0",
        position: { lat: 20.657179, lng: -100.403578 },
        image: IntelImg,
        staff: [
            { name: "Dr. Elena Ríos", position: "Directora de Innovación", phone: "442-987-6543" },
            { name: "Lic. Marcos Villa", position: "Especialista en Vinculación", phone: "442-987-6544" }
        ]
    },
    {
        id: 6,
        name: "Pidet",
        position: { lat: 20.65768, lng: -100.403577 },
        image: PidetImg,
        staff: [
            { name: "Dr. Alberto López", position: "Coordinador de Proyectos", phone: "442-246-8100" },
            { name: "Mtra. Susana Díaz", position: "Gestora Administrativa", phone: "442-246-8101" }
        ]
    },
    {
        id: 7,
        name: "Servicios escolares",
        position: { lat: 20.654232, lng: -100.40618 },
        image: "",
        staff: [
            { name: "Lic. René Rentería Contreras", position: "Secretario de Vinculación", phone: "442-123-4571" },
            { name: "Lic. Juan Torres", position: "Secretario", phone: "442-123-4572" }
        ]
    }
];

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