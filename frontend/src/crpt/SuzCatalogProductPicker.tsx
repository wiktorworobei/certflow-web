import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Autocomplete, Button, CircularProgress, TextField } from '@mui/material';
import type { CrptEnvironment } from './environment';
import type { SuzCatalogProduct } from './suz';
import { suzApi } from './suzApi';

type Props = {
  companyId: string;
  environment: CrptEnvironment;
  selectedThumbprint: string;
  productGroup: string;
  value: SuzCatalogProduct | null;
  disabled: boolean;
  onChange: (product: SuzCatalogProduct | null) => void;
};

export function SuzCatalogProductPicker({
  companyId,
  environment,
  selectedThumbprint,
  productGroup,
  value,
  disabled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const products = useInfiniteQuery({
    queryKey: ['suz-catalog-products', companyId, environment, selectedThumbprint, productGroup],
    enabled: Boolean(productGroup),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => suzApi.catalogProducts(productGroup, pageParam, signal),
    getNextPageParam: (page, _pages, pageNumber) => (page.hasNextPage ? pageNumber + 1 : undefined),
    staleTime: 60_000,
  });
  const { fetchNextPage, hasNextPage, isFetching, isError } = products;
  const showOptions = open && !disabled && Boolean(productGroup);

  useEffect(() => {
    if (showOptions && hasNextPage && !isFetching && !isError) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [showOptions, hasNextPage, isFetching, isError, fetchNextPage]);

  const options = useMemo(() => {
    if (!showOptions) return value ? [value] : [];
    const items = new Map<string, SuzCatalogProduct>();
    for (const page of products.data?.pages ?? []) {
      for (const product of page.items) items.set(product.gtin, product);
    }
    if (value && !items.has(value.gtin)) items.set(value.gtin, value);
    return [...items.values()];
  }, [products.data, showOptions, value]);
  const loading = products.isLoading || (showOptions && (isFetching || (hasNextPage && !isError)));

  return (
    <Autocomplete
      className="crpt-suz-order-product-picker"
      size="small"
      open={showOptions}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      openOnFocus
      options={options}
      value={value}
      disabled={disabled || !productGroup}
      loading={loading}
      loadingText="Загружаем товары…"
      noOptionsText={
        isError
          ? 'Не удалось загрузить товары'
          : options.length
            ? 'Товары не найдены'
            : 'В этой группе нет доступных товаров'
      }
      openText="Открыть список товаров"
      closeText="Закрыть список товаров"
      clearText="Очистить выбранный товар"
      getOptionKey={(product) => product.gtin}
      getOptionLabel={(product) => `${product.name} — ${product.gtin}`}
      isOptionEqualToValue={(option, selected) => option.gtin === selected.gtin}
      onChange={(_event, product) => onChange(product)}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Товар из Национального каталога"
          placeholder="Поиск по названию или GTIN"
          error={isError}
          helperText={
            isError && (
              <>
                {products.error.message}{' '}
                <Button
                  size="small"
                  disabled={disabled || isFetching}
                  onClick={() =>
                    void (products.isFetchNextPageError ? fetchNextPage() : products.refetch())
                  }
                >
                  Повторить загрузку товаров
                </Button>
              </>
            )
          }
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress color="inherit" size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
