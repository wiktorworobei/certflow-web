import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { EditOutlined, DeleteOutlineRounded } from '@mui/icons-material';
import { api } from './store';
import { ErrorState, Loading, useNotify, useWorkspace } from './common';
import { emptyLaboratoryDetails } from './evidenceTypes';
import { accreditationStatuses, LaboratoryFields } from './LaboratoryFields';
import { LaboratoryRegistrySource } from './LaboratoryRegistrySource';
import { laboratoryChanges, laboratoryRecordKinds } from './laboratoryRegistry';
import { errorMessage, type Laboratory, type LaboratoryRecordKind } from './types';

export function LaboratoryDirectory() {
  const {firmId,canEdit}=useWorkspace(); const notify=useNotify();
  const [input,setInput]=useState(''); const [search,setSearch]=useState(''); const [page,setPage]=useState(0);
  const [country,setCountry]=useState(''); const [kind,setKind]=useState<LaboratoryRecordKind|'All'>('Laboratory'); const [status,setStatus]=useState('');
  const [editing,setEditing]=useState<Laboratory|null>(null); const [baseline,setBaseline]=useState<Laboratory|null>(null);
  const [error,setError]=useState(''); const [confirm,setConfirm]=useState(false); const [accepted,setAccepted]=useState(false); const [deleting,setDeleting]=useState<Laboratory|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(input);setPage(0);},250);return()=>clearTimeout(timer);},[input]);
  useEffect(()=>{setEditing(null);setBaseline(null);setDeleting(null);setConfirm(false);setInput('');setSearch('');setPage(0);setError('');},[firmId]);
  const rows=api.useLaboratorySearchQuery({firmId,search,country,recordKind:kind,status,page:page+1,pageSize:25});
  const [save,saving]=api.useSaveLaboratoryMutation(); const [remove,removing]=api.useDeleteLaboratoryMutation();
  const changes=editing&&baseline?laboratoryChanges(baseline,editing):[];
  async function persist(override=false){
    if(!editing||editing.firmId!==firmId||!canEdit)return;
    if(editing.registrySource&&changes.length&&!override){setAccepted(false);setConfirm(true);return;}
    setError(''); try{const {id,firmId:_,...data}=editing;await save({firmId,id,data:{...data,acceptRegistryOverride:override}}).unwrap();setConfirm(false);setEditing(null);notify('Лаборатория сохранена');}catch(cause){setError(errorMessage(cause));setConfirm(false);}
  }
  const compact=(value:string)=>value.length>180?value.slice(0,180)+'…':value||'—';
  return <Box sx={{p:{xs:1.5,md:2.5},minWidth:0}}>
    <Alert severity="info" sx={{mb:2}}>Справочник содержит записи из предоставленной выгрузки ЕАЭС. В CSV есть лаборатории и другие органы оценки соответствия. Тип определён по наименованию; неясные записи выделены отдельно. Статусы отражают выгрузку, живая проверка ФГИС не выполнялась.</Alert>
    <Stack direction={{xs:'column',lg:'row'}} spacing={1.5} sx={{mb:2}}>
      <TextField label="Поиск в реестре лабораторий" value={input} onChange={e=>setInput(e.target.value)} placeholder="Название, аттестат, ТР, область или руководитель"/>
      <TextField select label="Тип записи реестра" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPage(0);}}><MenuItem value="All">Все записи CSV и ручные</MenuItem>{Object.entries(laboratoryRecordKinds).map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
      <TextField select label="Страна реестра" value={country} onChange={e=>{setCountry(e.target.value);setPage(0);}}><MenuItem value="">Все страны</MenuItem>{['Россия','Беларусь','Казахстан','Кыргызстан','Армения'].map(value=><MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <TextField select label="Статус аккредитации в реестре" value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><MenuItem value="">Все статусы</MenuItem>{Object.entries(accreditationStatuses).map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
    </Stack>
    {rows.isLoading||!rows.currentData&&rows.isFetching?<Loading/>:rows.error?<ErrorState error={rows.error} retry={rows.refetch}/>:<>
      <Typography variant="body2" sx={{mb:1}}>Найдено: {rows.currentData?.total ?? 0}. Для выбора в протоколе используются записи типа «Испытательная лаборатория».</Typography>
      <TableContainer className="responsive-table laboratory-table"><Table aria-label="Справочник лабораторий"><TableHead><TableRow>{['ИДЕНТ.','ПОЛНОЕ НАИМЕНОВАНИЕ','АТТЕСТАТ','СТАТУС','СТРАНА','ИСТОЧНИК',''].map((value,i)=><TableCell key={i}>{value}</TableCell>)}</TableRow></TableHead><TableBody>
        {rows.currentData?.items.map(lab=><TableRow key={lab.id} hover>
          <TableCell data-label="Идент.">{lab.details?.shortName||lab.details?.nationalRegistryId||'—'}</TableCell>
          <TableCell className="responsive-table-title"><Typography sx={{fontWeight:600,display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:3,overflow:'hidden',overflowWrap:'anywhere'}}>{lab.name}</Typography><Typography variant="caption" color="text.secondary">{laboratoryRecordKinds[lab.recordKind??'Laboratory']}</Typography></TableCell>
          <TableCell data-label="Аттестат">{lab.accreditationNumber||'Без аттестата'}</TableCell>
          <TableCell data-label="Статус">{accreditationStatuses[lab.details?.accreditationStatus??'Unknown']}<Typography variant="caption" component="p">В реестре: {lab.details?.registryStatus||'не указано'}</Typography></TableCell>
          <TableCell data-label="Страна">{lab.details?.country||'—'}</TableCell>
          <TableCell data-label="Источник"><Chip size="small" variant="outlined" color={lab.manuallyEditedFields?.length?'warning':'default'} label={lab.registrySource?(lab.manuallyEditedFields?.length?'CSV + правки':'CSV'):'Вручную'}/></TableCell>
          <TableCell className="responsive-table-actions"><IconButton aria-label={`${canEdit?'Редактировать':'Посмотреть'} ${lab.name}`} onClick={()=>{setEditing({...lab});setBaseline(lab);setError('');}}><EditOutlined fontSize="small"/></IconButton>{canEdit&&<IconButton aria-label={`Удалить лабораторию ${lab.name}`} onClick={()=>{setDeleting(lab);setError('');}}><DeleteOutlineRounded fontSize="small"/></IconButton>}</TableCell>
        </TableRow>)}
      </TableBody></Table></TableContainer>
      {!rows.currentData?.items.length&&<Typography sx={{p:3}}>Лаборатории не найдены. Измените фильтры или добавьте запись вручную.</Typography>}
      <TablePagination component="div" count={rows.currentData?.total??0} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_,next)=>setPage(next)} labelDisplayedRows={({from,to,count})=>`${from}–${to} из ${count}`} labelRowsPerPage="Записей:"/>
    </>}
    <Dialog open={!!editing} onClose={()=>!saving.isLoading&&setEditing(null)} maxWidth="md" fullWidth aria-labelledby="laboratory-registry-editor">
      <form onSubmit={e=>{e.preventDefault();void persist();}}><DialogTitle id="laboratory-registry-editor">{canEdit?'Редактирование лаборатории':'Запись реестра лабораторий'}</DialogTitle><DialogContent>
        {editing&&<><LaboratoryRegistrySource lab={editing}/>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}<Grid container spacing={2} sx={{mt:.5}}>
          <Grid item xs={12}><TextField label="Наименование лаборатории" required value={editing.name} disabled={!canEdit} onChange={e=>setEditing({...editing,name:e.target.value})}/></Grid>
          <Grid item xs={12} sm={6}><TextField label="Номер аккредитации" value={editing.accreditationNumber} disabled={!canEdit} onChange={e=>setEditing({...editing,accreditationNumber:e.target.value})}/></Grid>
          <Grid item xs={12} sm={6}><TextField select label="Тип записи" value={editing.recordKind??'Laboratory'} disabled={!canEdit} onChange={e=>setEditing({...editing,recordKind:e.target.value as LaboratoryRecordKind})}>{Object.entries(laboratoryRecordKinds).map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12}><TextField label="Адрес" multiline minRows={2} maxRows={5} value={editing.address} disabled={!canEdit} onChange={e=>setEditing({...editing,address:e.target.value})}/></Grid>
          <LaboratoryFields value={{...emptyLaboratoryDetails(),...editing.details}} disabled={!canEdit} onChange={details=>setEditing({...editing,details})}/>
        </Grid></>}
      </DialogContent><DialogActions><Button disabled={saving.isLoading} onClick={()=>setEditing(null)}>Отмена</Button>{canEdit&&<Button variant="contained" type="submit" disabled={saving.isLoading}>Сохранить</Button>}</DialogActions></form>
    </Dialog>
    <Dialog open={confirm} onClose={()=>!saving.isLoading&&setConfirm(false)} maxWidth="sm" fullWidth aria-labelledby="laboratory-manual-risk">
      <DialogTitle id="laboratory-manual-risk">Ручное изменение данных реестра</DialogTitle><DialogContent>
        <Alert severity="warning">Вы меняете сведения из CSV на свой страх и риск. Изменения сохранятся только в вашей компании. Исходная запись останется доступна; правки не являются подтверждением данных ФГИС.</Alert>
        <Box component="ul" sx={{pl:2.5,overflowWrap:'anywhere'}}>{changes.map(change=><li key={change.key}><strong>{change.label}:</strong> {compact(change.before)} → {compact(change.after)}</li>)}</Box>
        <FormControlLabel control={<Checkbox checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>} label="Я проверю данные и принимаю ответственность за ручные изменения"/>
      </DialogContent><DialogActions><Button disabled={saving.isLoading} onClick={()=>setConfirm(false)}>Вернуться к редактированию</Button><Button variant="contained" disabled={!accepted||saving.isLoading} onClick={()=>void persist(true)}>Сохранить мои изменения</Button></DialogActions>
    </Dialog>
    <Dialog open={!!deleting} onClose={()=>!removing.isLoading&&setDeleting(null)} maxWidth="sm" fullWidth><DialogTitle>Удалить лабораторию из справочника?</DialogTitle><DialogContent><Typography>{deleting?.name}</Typography><Typography sx={{mt:2}}>Запись исчезнет из выбора. Снимки в сохранённых протоколах и направлениях останутся. Удалённая запись CSV не появится снова при перезапуске.</Typography>{error&&<Alert severity="error">{error}</Alert>}</DialogContent><DialogActions><Button disabled={removing.isLoading} onClick={()=>setDeleting(null)}>Отмена</Button><Button color="error" disabled={removing.isLoading} onClick={async()=>{if(!deleting||deleting.firmId!==firmId)return;try{await remove({firmId,id:deleting.id}).unwrap();setDeleting(null);if(rows.currentData?.items.length===1&&page>0)setPage(page-1);notify('Лаборатория удалена');}catch(cause){setError(errorMessage(cause));}}}>Удалить запись</Button></DialogActions></Dialog>
  </Box>;
}
