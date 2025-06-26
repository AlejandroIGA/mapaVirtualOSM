import React, { useState, useEffect } from 'react';
import './Header.css'
import logoUteq from '../../assets/logo-uteq-x2.png'

const Header = () => {
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

    return (
        <header className='header-component'>
            <div className="header-left">
                <img src={logoUteq} alt="Logo UTEQ" />
            </div>
            
            <div className="header-right">
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
                            <span className="tracking-text">Detener Seguimiento</span>
                        </>
                    ) : (
                        <>
                            <span className="tracking-icon">🎯</span>
                            <span className="tracking-text">Iniciar Seguimiento</span>
                        </>
                    )}
                </button>
            </div>
        </header>
    )
}

export default Header;