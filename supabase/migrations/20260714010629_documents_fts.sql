-- Ricerca completa nei documenti: Full Text Search in italiano su nome file,
-- titolo, riassunto, spiegazione e punti chiave dell'analisi AI. I risultati
-- restano filtrati dalla RLS esistente ("own documents").

alter table public.documents
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'italian',
      coalesce(file_name, '') || ' ' ||
      coalesce(analysis ->> 'title', '') || ' ' ||
      coalesce(analysis ->> 'summary', '') || ' ' ||
      coalesce(analysis ->> 'explanation', '') || ' ' ||
      coalesce(analysis ->> 'key_points', '')
    )
  ) stored;

create index if not exists idx_documents_search
  on public.documents using gin (search_vector);
