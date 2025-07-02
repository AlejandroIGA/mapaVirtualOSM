import React, { useState, useEffect } from 'react';
import './Header.css'
import logoUteq from '../../assets/logo-uteq-x2.png'

const Header = ({ onManualLocationClick }) => {
    const [trackingStatus, setTrackingStatus] = useState({
        isTracking: false,
        locationAvailable: false,
        userLocation: null
    });

    // Verificar estado del tracking periódicamente
    useEffect(() => {
        const checkTrackingStatus = () => {
            if (window.getTrackingStatus) {
                const status = window.getTrackingStatus();
                setTrackingStatus(status);
            }
        };

        // Verificar inmediatamente
        checkTrackingStatus();

        // Verificar cada segundo para mantener el estado actualizado
        const interval = setInterval(checkTrackingStatus, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleToggleTracking = () => {
        if (window.toggleLocationTracking) {
            window.toggleLocationTracking();
        } else {
            console.warn('⚠️ Función de seguimiento no disponible aún');
        }
    };

    const handleManualLocation = () => {
        if (onManualLocationClick) {
            onManualLocationClick();
        }
    };

    return (
        <header className='header-component'>
            <div className="header-left">
                <img src={logoUteq} alt="Logo UTEQ" />
            </div>
            
            <div className="header-right">
                {/* Botón de ubicación manual */}
                <button
                    onClick={handleManualLocation}
                    className="manual-location-button"
                    title="Establecer ubicación manual para pruebas"
                >
                    <span className="manual-icon">📍</span>
                    <span className="manual-text">Ubicación Manual</span>
                </button>

                {/* Botón de tracking GPS */}
                <button
                    onClick={handleToggleTracking}
                    className={`tracking-button ${trackingStatus.isTracking ? "active" : "inactive"}`}
                    disabled={!trackingStatus.locationAvailable}
                    title={
                        !trackingStatus.locationAvailable 
                            ? "GPS no disponible" 
                            : trackingStatus.isTracking 
                                ? "Detener seguimiento de ubicación" 
                                : "Iniciar seguimiento de ubicación"
                    }
                >
                    {trackingStatus.isTracking ? (
                        <>
                            <span className="tracking-icon">🛑</span>
                            <span className="tracking-text">Detener GPS</span>
                        </>
                    ) : (
                        <>
                            <span className="tracking-icon">🎯</span>
                            <span className="tracking-text">Iniciar GPS</span>
                        </>
                    )}
                </button>
            </div>
        </header>
    )
}

export default Header;