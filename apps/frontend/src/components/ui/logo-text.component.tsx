import React from 'react';

// Mr Box Social — logo testuale, due varianti per tema (body.dark / body.light)
export const LogoTextComponent = () => {
  return (
    <div className="flex items-center h-[44px]">
      <img
        src="/mrbox-logo-dark.png"
        alt="Mr Box Social"
        className="mrbox-logo-on-dark h-[44px] w-auto"
      />
      <img
        src="/mrbox-logo-light.png"
        alt="Mr Box Social"
        className="mrbox-logo-on-light h-[44px] w-auto"
      />
    </div>
  );
};
