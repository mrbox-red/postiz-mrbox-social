'use client';

import React, { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useForm, FormProvider } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SubaccountDto } from '@gitroom/nestjs-libraries/dtos/agency/subaccount.dto';

interface Subaccount {
  id: string;
  name: string;
  createdAt: string;
  users: { role: 'USER' | 'ADMIN' | 'SUPERADMIN'; disabled: boolean }[];
  _count: { users: number; Integration: number };
}

const useSubaccounts = () => {
  const fetch = useFetch();
  return useSWR<Subaccount[]>(
    '/agency/subaccounts',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load subaccounts');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};

const SubaccountForm: FC<{
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
}> = ({ initialName, submitLabel, onSubmit }) => {
  const t = useT();
  const resolver = useMemo(() => classValidatorResolver(SubaccountDto), []);
  const form = useForm({
    values: { name: initialName || '' },
    resolver,
    mode: 'onChange',
  });
  const submit = useCallback(
    async (values: { name: string }) => {
      await onSubmit(values.name);
    },
    [onSubmit]
  );
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="relative flex gap-[10px] flex-col flex-1 p-[16px] pt-0">
          <Input
            label={t('subaccount_name', 'Subaccount name')}
            placeholder={t('subaccount_name_placeholder', 'e.g. Mister Box')}
            name="name"
          />
          <Button type="submit" className="mt-[18px]">
            {submitLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export const SubaccountsComponent = () => {
  const fetch = useFetch();
  const user = useUser();
  const modals = useModals();
  const toast = useToaster();
  const t = useT();
  const { data, mutate } = useSubaccounts();

  const readError = useCallback(async (res: Response) => {
    try {
      const body = await res.json();
      return body?.message || res.statusText;
    } catch (e) {
      return res.statusText;
    }
  }, []);

  const openCreate = useCallback(() => {
    modals.openModal({
      classNames: { modal: 'bg-transparent text-textColor' },
      title: t('new_subaccount', 'New subaccount'),
      withCloseButton: true,
      children: (
        <SubaccountForm
          submitLabel={t('create_subaccount', 'Create subaccount')}
          onSubmit={async (name) => {
            const res = await fetch('/agency/subaccounts', {
              method: 'POST',
              body: JSON.stringify({ name }),
            });
            if (!res.ok) {
              toast.show(await readError(res), 'warning');
              return;
            }
            modals.closeAll();
            toast.show(t('subaccount_created', 'Subaccount created'));
            await mutate();
          }}
        />
      ),
    });
  }, [t, mutate]);

  const openRename = useCallback(
    (sub: Subaccount) => () => {
      modals.openModal({
        classNames: { modal: 'bg-transparent text-textColor' },
        title: t('rename_subaccount', 'Rename subaccount'),
        withCloseButton: true,
        children: (
          <SubaccountForm
            initialName={sub.name}
            submitLabel={t('save', 'Save')}
            onSubmit={async (name) => {
              const res = await fetch(`/agency/subaccounts/${sub.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name }),
              });
              if (!res.ok) {
                toast.show(await readError(res), 'warning');
                return;
              }
              modals.closeAll();
              toast.show(t('subaccount_renamed', 'Subaccount renamed'));
              await mutate();
            }}
          />
        ),
      });
    },
    [t, mutate]
  );

  const enter = useCallback(
    (sub: Subaccount) => async () => {
      const res = await fetch(`/agency/subaccounts/${sub.id}/enter`, {
        method: 'POST',
      });
      if (!res.ok) {
        toast.show(await readError(res), 'warning');
        return;
      }
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({ id: sub.id }),
      });
      window.location.href = '/launches';
    },
    []
  );

  const archive = useCallback(
    (sub: Subaccount) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_archive_subaccount',
            'Archive this subaccount? Nobody will be able to enter it anymore.'
          )
        ))
      ) {
        return;
      }
      const res = await fetch(`/agency/subaccounts/${sub.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.show(await readError(res), 'warning');
        return;
      }
      toast.show(t('subaccount_archived', 'Subaccount archived'));
      await mutate();
    },
    [t, mutate]
  );

  return (
    <div className="flex flex-col">
      <h3 className="text-[20px]">{t('subaccounts', 'Subaccounts')}</h3>
      <div className="text-customColor18 mt-[4px]">
        {t(
          'subaccounts_description',
          'Every subaccount is a separate business with its own channels, calendar and team.'
        )}
      </div>
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[24px]">
        <div className="flex flex-col gap-[12px]">
          <div className="grid grid-cols-[1fr_90px_90px_260px] gap-[12px] text-[12px] uppercase opacity-70">
            <div>{t('name', 'Name')}</div>
            <div>{t('members', 'Members')}</div>
            <div>{t('channels', 'Channels')}</div>
            <div />
          </div>
          {(data || []).map((sub) => {
            const isCurrent = sub.id === user?.orgId;
            return (
              <div
                key={sub.id}
                className="grid grid-cols-[1fr_90px_90px_260px] gap-[12px] items-center"
              >
                <div className="truncate">
                  {sub.name}
                  {isCurrent && (
                    <span className="text-customColor18">
                      {' '}
                      ({t('current_subaccount', 'current')})
                    </span>
                  )}
                </div>
                <div>{sub._count.users}</div>
                <div>{sub._count.Integration}</div>
                <div className="flex gap-[8px] justify-end">
                  {!isCurrent && (
                    <Button className="!h-[28px] text-[12px]" onClick={enter(sub)}>
                      {t('enter_subaccount', 'Enter')}
                    </Button>
                  )}
                  <Button
                    className="!h-[28px] text-[12px]"
                    secondary={true}
                    onClick={openRename(sub)}
                  >
                    {t('rename', 'Rename')}
                  </Button>
                  {!isCurrent && (
                    <Button
                      className="!h-[28px] text-[12px]"
                      secondary={true}
                      onClick={archive(sub)}
                    >
                      {t('archive', 'Archive')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <Button onClick={openCreate}>
            {t('new_subaccount', 'New subaccount')}
          </Button>
        </div>
      </div>
    </div>
  );
};
