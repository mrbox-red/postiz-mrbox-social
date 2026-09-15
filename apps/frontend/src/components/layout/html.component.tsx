'use client';
import { FC, useEffect } from 'react';

// Viral Starz: solo italiano. La direzione è sempre da sinistra a destra.
// Prima veniva letta da i18next.dir(), che restituisce "rtl" finché la lingua
// non è ancora risolta e specchiava il calendario.
export const HtmlComponent: FC = () => {
  useEffect(() => {
    const htmlElement = document.querySelector('html');
    if (htmlElement) {
      htmlElement.setAttribute('dir', 'ltr');
    }
  }, []);

  return null;
};
