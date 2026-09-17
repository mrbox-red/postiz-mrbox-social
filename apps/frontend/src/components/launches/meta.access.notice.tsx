'use client';

import React, { FC } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

// Canali Meta che richiedono che la persona abbia accettato l'invito
// all'app Facebook di Viral Starz prima del login OAuth.
export const META_NOTICE_IDENTIFIERS = ['facebook', 'instagram'];

export const MetaAccessNotice: FC<{
  onContinue: () => void;
  onCancel: () => void;
}> = ({ onContinue, onCancel }) => {
  const t = useT();
  return (
    <div className="flex flex-col gap-[16px] text-textColor text-[14px] leading-[1.5]">
      <p>
        {t(
          'meta_notice_intro',
          "Per collegare le tue pagine devi prima accettare l'invito che Viral Starz ti ha mandato su Facebook. Si fa una volta sola."
        )}
      </p>
      <ol className="list-decimal ps-[20px] flex flex-col gap-[8px]">
        <li>
          {t(
            'meta_notice_step_1',
            'Su Facebook apri Impostazioni e privacy › Impostazioni › App e siti web › Inviti e accetta l\'invito "Viral Starz".'
          )}
        </li>
        <li>
          {t(
            'meta_notice_step_2',
            'Torna qui e premi Continua: si apre Facebook, scegli le pagine da collegare.'
          )}
        </li>
      </ol>
      <p className="opacity-80">
        {t(
          'meta_notice_warning',
          "Non usare il link nella notifica di Facebook: porta al portale sviluppatori e chiede una registrazione che non serve. Se non trovi l'invito, chiedi a chi ti ha creato l'account Viral Starz: deve aggiungerti nell'app con il tuo nome Facebook."
        )}
      </p>
      <p className="opacity-80">
        {t(
          'meta_notice_error_hint',
          'Se dopo Continua Facebook mostra "Funzione non disponibile", l\'invito non è ancora stato accettato.'
        )}
      </p>
      <div className="flex gap-[8px] justify-end pt-[4px]">
        <Button type="button" secondary onClick={onCancel}>
          {t('cancel', 'Annulla')}
        </Button>
        <Button type="button" onClick={onContinue}>
          {t('meta_notice_continue', 'Continua')}
        </Button>
      </div>
    </div>
  );
};
