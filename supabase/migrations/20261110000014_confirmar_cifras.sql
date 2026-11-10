-- Gallo Negro confirmó las cifras del programa de GN (2026-11-10): dejan de ser BORRADOR.
-- Los términos (gn_terms) siguen marcados como borrador hasta su revisión legal.
update public.gn_config set is_draft = false where is_draft;
update public.identity_requirements set is_draft = false where is_draft;
