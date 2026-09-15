'use client';

import { FC, useEffect } from 'react';

// Viral Starz: solo italiano, quindi la pagina è sempre da sinistra a destra
// (anche con un vecchio cookie di lingua "he" o "ar" rimasto nel browser).
export const ChangeDir: FC = () => {
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'ltr');
  }, []);

  return null;
};
