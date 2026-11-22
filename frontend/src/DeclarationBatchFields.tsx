import { useId, useState } from 'react';
import { Box, Button, IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { AddRounded, DeleteOutlineRounded } from '@mui/icons-material';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { DeclarationField } from './DeclarationFields';
import type { Product, SaveDeclaration } from './types';
import { formatShippingDocuments } from './declarationBatchFormatting';

const documentNames = ['Контракт', 'Договор', 'Инвойс', 'Другой документ'];
const documentLimit = 30;

function printBatchDetails(product: Product) {
  const isBatch = product.productionType === 'Batch';
  const quantity = product.batchQuantity?.trim();
  const size =
    isBatch && quantity ? [quantity, product.batchUnit?.trim()].filter(Boolean).join(' ') : '';
  const production = isBatch
    ? 'Партия'
    : product.productionType === 'Single'
      ? 'Единичное изделие'
      : 'Серийный выпуск';
  const description = [[production, size].filter(Boolean).join(' '), product.batchDetails?.trim()]
    .filter(Boolean)
    .join(', ');
  const documents = formatShippingDocuments(product.shippingDocuments);
  return documents ? `${description}. ${documents}` : description;
}

export function DeclarationBatchFields({ readOnly }: { readOnly: boolean }) {
  const { control } = useFormContext<SaveDeclaration>();
  const product = useWatch({ control, name: 'product' });
  const { fields, append, remove } = useFieldArray({ control, name: 'product.shippingDocuments' });
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const shippingTitle = useId();
  const isBatch = product.productionType === 'Batch';

  if (product.productionType === 'Serial' && !fields.length) return null;

  return (
    <Stack spacing={2}>
      {isBatch && (
        <>
          <DeclarationField
            name="product.batchQuantity"
            label="Количество в партии"
            disabled={readOnly}
            inputProps={{ maxLength: 30, inputMode: 'decimal' }}
          />
          <DeclarationField
            name="product.batchUnit"
            label="Единица измерения"
            disabled={readOnly}
            inputProps={{ maxLength: 50, placeholder: 'Например, штук' }}
          />
          <DeclarationField
            name="product.batchIdentifier"
            label="Идентификатор партии (GS1)"
            disabled={readOnly}
            inputProps={{ maxLength: 100 }}
          />
        </>
      )}
      <Stack spacing={2} component="section" aria-labelledby={shippingTitle}>
        <Typography id={shippingTitle} component="h3" variant="subtitle2">
          Товаросопроводительные документы
        </Typography>
        {fields.map((field, index) => (
          <Box
            component="fieldset"
            key={field.id}
            sx={{
              minWidth: 0,
              m: 0,
              px: 1.5,
              pb: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Typography component="legend" variant="body2">
              Документ {index + 1}
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <DeclarationField
                name={`product.shippingDocuments.${index}.name`}
                label="Наименование документа"
                disabled={readOnly}
                inputProps={{ maxLength: 150 }}
              />
              <DeclarationField
                name={`product.shippingDocuments.${index}.number`}
                label="Номер документа"
                disabled={readOnly}
                inputProps={{ maxLength: 150 }}
              />
              <DeclarationField
                name={`product.shippingDocuments.${index}.date`}
                label="Дата документа"
                type="date"
                disabled={readOnly}
                inputProps={{ min: '0001-01-01', max: '9999-12-31' }}
              />
              {!readOnly && (
                <IconButton
                  type="button"
                  aria-label={`Удалить документ ${index + 1}`}
                  onClick={() => remove(index)}
                  sx={{ alignSelf: 'flex-end' }}
                >
                  <DeleteOutlineRounded />
                </IconButton>
              )}
            </Stack>
          </Box>
        ))}
        {!readOnly && (
          <>
            <Button
              type="button"
              startIcon={<AddRounded />}
              aria-haspopup="menu"
              aria-expanded={Boolean(menuAnchor)}
              aria-controls={menuAnchor ? menuId : undefined}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              disabled={fields.length >= documentLimit}
              sx={{ alignSelf: 'flex-start' }}
            >
              Добавить документ
            </Button>
            <Menu
              id={menuId}
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              {documentNames.map((name) => (
                <MenuItem
                  key={name}
                  onClick={() => {
                    setMenuAnchor(null);
                    append(
                      { name: name === 'Другой документ' ? '' : name, number: '', date: null },
                      { shouldFocus: false },
                    );
                  }}
                >
                  {name}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
      <Box>
        <Typography variant="subtitle2">Печатная формулировка</Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {printBatchDetails(product)}
        </Typography>
      </Box>
    </Stack>
  );
}
