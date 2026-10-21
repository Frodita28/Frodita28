-- =============================================================================
-- Almacenamiento privado de evidencias (Supabase Storage).
-- Cada licenciado solo puede subir y leer archivos dentro de su carpeta <user_id>/.
-- Los administradores pueden leer todas las evidencias para revisarlas.
-- Nadie puede reemplazar ni borrar una evidencia ya subida desde la API.
-- =============================================================================
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Esquema storage no disponible: se omite la configuración de evidencias';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('evidences', 'evidences', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy evidences_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'evidences' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy evidences_select_own_or_admin on storage.objects for select to authenticated
    using (bucket_id = 'evidences' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  $p$;
end;
$$;
