import './SearchBar.css'

const SearchBar = () => {
    return(
        <div className="search-bar">
             <div className="search-bar-container">
            <input
                type="text"
                className="search-input"
                placeholder="Buscar...."
            />
            {/* Puedes usar un SVG inline, una imagen, o un icono de librería si la tienes */}
            <span className="search-icon">
                {/* SVG de una lupa simple */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm6.32-1.63a9 9 0 111.41-1.41l3.59 3.59a1 1 0 01-1.41 1.41l-3.59-3.59z"/>
                </svg>
            </span>
        </div>
        </div>
    )
}

export default SearchBar;