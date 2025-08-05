import React, { useState } from 'react';
import './StaffModal.css';

const StaffModal = ({ isOpen, onClose, staff, buildingName }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  if (!isOpen) return null;

  const totalPages = Math.ceil(staff.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentStaff = staff.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>👥 Personal en {buildingName}</h2>
        {staff.length === 0 ? (
          <p style={{ fontStyle: 'italic' }}>No se encontró personal en este edificio.</p>
        ) : (
          <>
            <ul>
              {currentStaff.map((person, index) => (
                <li key={index} style={{ marginBottom: '10px' }}>
                  <strong>{person.name}</strong><br />
                  💼 {person.position}<br />
                  📌 {person.shift}<br />
                  <small><i>🕒 {person.schedule}</i></small><br />
                </li>
              ))}
            </ul>
            {/* Paginación */}
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button onClick={handlePrevious} disabled={currentPage === 1}>
                  ◀
                </button>
                <span>Página {currentPage} de {totalPages}</span>
                <button onClick={handleNext} disabled={currentPage === totalPages}>
                  ▶
                </button>
              </div>
            )}
          </>
        )}
        <button onClick={onClose} className="modal-close">Cerrar</button>
      </div>
    </div>
  );
};

export default StaffModal;