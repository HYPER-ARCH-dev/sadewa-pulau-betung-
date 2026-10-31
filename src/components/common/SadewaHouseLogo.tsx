import React from 'react';

interface SadewaHouseLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

/**
 * SadewaHouseLogo - Komponen Logo Ikonik SADEWA (Simbol Rumah) 
 * Murni menggunakan kode SVG vektor presisi tinggi dengan fillRule="evenodd"
 * sesuai lambang resmi SADEWA Desa Pulau Betung.
 */
export const SadewaHouseLogo: React.FC<SadewaHouseLogoProps> = ({ 
  className = "", 
  size = 40, 
  color = "currentColor" 
}) => {
  const hasTextColor = className.includes('text-');
  const finalClassName = hasTextColor ? className : `text-[#0B6A3E] ${className}`.trim();

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 240 240" 
      fill={color} 
      xmlns="http://www.w3.org/2000/svg"
      className={finalClassName}
    >
      <path 
        fillRule="evenodd" 
        d="M 120 28 L 30 98 L 42 113 L 120 54 L 198 113 L 210 98 Z M 165 40 L 183 40 L 183 85 L 165 71 Z M 120 66 L 175 109 L 175 146 L 158.157 146 A 41 41 0 0 0 81.843 146 L 65 146 L 65 109 Z M 111 92 L 111 110 L 129 110 L 129 92 Z M 55 154 L 79.602 154 A 41 41 0 0 0 79.602 168 L 55 168 Z M 160.398 154 L 185 154 L 185 168 L 160.398 168 A 41 41 0 0 0 160.398 154 Z M 67.085 176 L 81.843 176 A 41 41 0 0 0 158.157 176 L 172.915 176 A 55 55 0 0 1 67.085 176 Z M 120 128 a 33 33 0 1 0 0 66 a 33 33 0 1 0 0 -66 Z M 120 142 a 19 19 0 1 1 0 38 a 19 19 0 1 1 0 -38 Z" 
      />
    </svg>
  );
};

interface SadewaFullLogoProps extends SadewaHouseLogoProps {
  subtitle?: string;
  variant?: 'horizontal' | 'vertical';
  size?: number;
  textColor?: string;
  subtitleColor?: string;
  showTagline?: boolean;
  showSubtitle?: boolean;
}

/**
 * SadewaFullLogo - Komponen Branding Lengkap SADEWA
 * Menggabungkan Simbol Rumah dengan Tipografi Brand SADEWA Digital.
 */
export const SadewaFullLogo: React.FC<SadewaFullLogoProps> = ({
  className = "",
  size = 40,
  color = "#0B6A3E", // Official SADEWA Forest Green
  textColor = "text-[#0f172a]",
  subtitleColor = "text-slate-500",
  subtitle = "Desa Pulau Betung",
  variant = "horizontal",
  showTagline = true,
  showSubtitle = true
}) => {
  const isVertical = variant === 'vertical';
  const isDark = textColor.includes('white') || textColor.includes('slate-50') || textColor.includes('emerald-50');
  
  // Official colors from branding image
  const greenColor = isDark ? "#ffffff" : color;
  const navyColor = isDark ? "#34d399" : "#001f3f";
  
  return (
    <div className={`flex ${isVertical ? 'flex-col items-center text-center' : 'items-center space-x-4'} ${className}`}>
      <SadewaHouseLogo size={size} color={greenColor} />
      <div className={`flex flex-col justify-center leading-none ${isVertical ? 'mt-4' : ''}`}>
        <div className="flex items-center">
          <span 
            className="font-black tracking-tighter uppercase" 
            style={{ 
              fontSize: isVertical ? `${size * 0.8}px` : `${size * 0.7}px`,
              color: greenColor
            }}
          >
            SADE
          </span>
          <span 
            className="font-black tracking-tighter uppercase" 
            style={{ 
              fontSize: isVertical ? `${size * 0.8}px` : `${size * 0.7}px`,
              color: navyColor
            }}
          >
            WA
          </span>
        </div>
        
        {(showTagline || showSubtitle) && (
          <div className={`flex flex-col ${isVertical ? 'items-center mt-1.5' : ''}`}>
            {showTagline && (
              <span 
                className={`font-bold uppercase tracking-[0.01em] ${isDark ? 'text-white/80' : 'text-slate-800'}`}
                style={{ fontSize: isVertical ? `${size * 0.13}px` : `${size * 0.11}px` }}
              >
                Sistem Administrasi Digital & Efisiensi Layanan Warga
              </span>
            )}
            {showSubtitle && (
              <span 
                className={`font-bold uppercase tracking-[0.15em] ${isDark ? 'text-emerald-400' : 'text-slate-500'} mt-0.5`}
                style={{ fontSize: isVertical ? `${size * 0.13}px` : `${size * 0.11}px`, marginLeft: isVertical ? '0' : 'auto' }}
              >
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
