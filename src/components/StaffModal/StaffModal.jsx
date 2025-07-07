// components/StaffModal.jsx
import React from 'react';
import './StaffModal.css';

const StaffModal = ({ isOpen, onClose, staff, buildingName }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>👥 Personal en {buildingName}</h2>
        {staff.length === 0 ? (
          <p style={{ fontStyle: 'italic' }}>No se encontró personal en este edificio.</p>
        ) : (
          <ul>
            {staff.map((person, index) => (
              <li key={index} style={{ marginBottom: '10px' }}>
                <strong>{person.name}</strong><br />
                💼 {person.position}<br />
                🕒 {person.shift}<br />
              </li>
            ))}
          </ul>
        )}
        <button onClick={onClose} className="modal-close">Cerrar</button>
      </div>
    </div>
  );
};

export default StaffModal;