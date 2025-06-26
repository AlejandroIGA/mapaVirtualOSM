// utils/locationUtils.js
// 🎉 ESTE ARCHIVO NO CAMBIA - Es independiente del proveedor de mapas

/**
 * Verifica el estado de los permisos de geolocalización
 */
export const checkLocationPermission = async () => {
    if (!navigator.permissions) {
        return { state: 'unavailable', message: 'API de permisos no disponible' };
    }

    try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return {
            state: permission.state, // 'granted', 'denied', 'prompt'
            message: getPermissionMessage(permission.state)
        };
    } catch (error) {
        return { state: 'error', message: 'Error verificando permisos' };
    }
};

/**
 * Obtiene mensaje descriptivo del estado del permiso
 */
const getPermissionMessage = (state) => {
    const messages = {
        granted: 'Permisos de ubicación concedidos',
        denied: 'Permisos de ubicación denegados',
        prompt: 'Se solicitarán permisos de ubicación'
    };
    return messages[state] || 'Estado de permisos desconocido';
};

/**
 * Verifica si la geolocalización está disponible
 */
export const isGeolocationAvailable = () => {
    return 'geolocation' in navigator;
};

/**
 * Solicita permisos de ubicación de manera explícita
 */
export const requestLocationPermission = async () => {
    if (!isGeolocationAvailable()) {
        throw new Error('Geolocalización no disponible en este navegador');
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            () => {
                resolve({ granted: true, message: 'Permisos concedidos' });
            },
            (error) => {
                const errorInfo = handleLocationError(error);
                reject({ granted: false, error: errorInfo });
            },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: Infinity
            }
        );
    });
};

/**
 * Maneja errores de geolocalización
 */
export const handleLocationError = (error) => {
    const errorDetails = {
        [error.PERMISSION_DENIED]: {
            code: 'PERMISSION_DENIED',
            message: 'Permiso de ubicación denegado por el usuario',
            userFriendly: 'Para usar esta función, necesitas permitir el acceso a tu ubicación en la configuración del navegador.'
        },
        [error.POSITION_UNAVAILABLE]: {
            code: 'POSITION_UNAVAILABLE',
            message: 'Ubicación no disponible',
            userFriendly: 'No se pudo determinar tu ubicación. Verifica que tengas GPS activado.'
        },
        [error.TIMEOUT]: {
            code: 'TIMEOUT',
            message: 'Tiempo de espera agotado',
            userFriendly: 'La búsqueda de ubicación tardó demasiado. Inténtalo de nuevo.'
        }
    };

    const errorInfo = errorDetails[error.code] || {
        code: 'UNKNOWN',
        message: 'Error desconocido de ubicación',
        userFriendly: 'Ocurrió un error inesperado al obtener tu ubicación.'
    };

    console.error('Location Error:', errorInfo.message);
    return errorInfo;
};

/**
 * Obtiene la ubicación actual del usuario con validaciones
 */
export const getCurrentUserLocation = async (options) => {
    if (!isGeolocationAvailable()) {
        throw new Error('Geolocalización no disponible en este navegador');
    }

    const permissionStatus = await checkLocationPermission();
    if (permissionStatus.state === 'denied') {
        throw new Error('Permisos de ubicación denegados. Habilítalos en la configuración del navegador.');
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                resolve(location);
            },
            (error) => {
                const errorInfo = handleLocationError(error);
                reject(new Error(errorInfo.userFriendly));
            },
            options
        );
    });
};

/**
 * Inicia el seguimiento de ubicación con validaciones
 */
export const startLocationTracking = async (onUpdate, onError, options) => {
    if (!isGeolocationAvailable()) {
        onError(new Error('Geolocalización no disponible en este navegador'));
        return null;
    }

    try {
        const permissionStatus = await checkLocationPermission();

        if (permissionStatus.state === 'denied') {
            onError(new Error('Permisos de ubicación denegados. Habilítalos en la configuración del navegador.'));
            return null;
        }

        if (permissionStatus.state === 'prompt') {
            try {
                await requestLocationPermission();
            } catch (permissionError) {
                onError(new Error(permissionError.error.userFriendly));
                return null;
            }
        }
    } catch (error) {
        console.warn('No se pudieron verificar permisos, intentando directamente');
    }

    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };
            onUpdate(location);
        },
        (error) => {
            const errorInfo = handleLocationError(error);
            onError(new Error(errorInfo.userFriendly));
        },
        options
    );

    return watchId;
};

/**
 * Detiene el seguimiento de ubicación
 */
export const stopLocationTracking = (watchId) => {
    if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        console.log('🛑 Seguimiento de ubicación detenido');
    }
};

/**
 * Obtiene información detallada sobre el estado de la geolocalización
 */
export const getLocationStatus = async () => {
    const status = {
        available: isGeolocationAvailable(),
        permission: null,
        supported: true
    };

    if (status.available) {
        status.permission = await checkLocationPermission();
    } else {
        status.supported = false;
    }

    return status;
};