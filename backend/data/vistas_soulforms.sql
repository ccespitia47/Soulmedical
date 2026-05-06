-- ============================================================
--  VISTAS SOULFORMS  –  Ejecutar en pgAdmin / DB Viewer
--  Base de datos: soulformsdb
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- VISTA BASE: v_datos_diligenciados
-- Una fila por campo por respuesta (con nombre real del campo)
-- No tocar — la usan las vistas pivot
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_datos_diligenciados AS
SELECT
    fs.id                                               AS respuesta_id,
    p.name                                              AS proyecto,
    fo.name                                             AS carpeta,
    f.name                                              AS formulario,
    fs."submittedAt"                                    AS fecha_envio,
    COALESCE(u.name, 'Anónimo')                         AS diligenciado_por,
    widget->>'label'                                    AS campo,
    widget->>'type'                                     AS tipo_campo,
    CASE
        WHEN widget->>'type' = 'signature'
            THEN CASE
                WHEN fs.data ->> (widget->>'id') = '' OR fs.data ->> (widget->>'id') IS NULL
                THEN '(sin firma)'
                ELSE '(firma capturada)'
            END
        ELSE COALESCE(fs.data ->> (widget->>'id'), '')
    END                                                 AS valor
FROM form_submissions fs
JOIN forms    f  ON f.id  = fs.form_id
JOIN folders  fo ON fo.id = f.folder_id
JOIN projects p  ON p.id  = fo.project_id
LEFT JOIN users u ON u.id = fs.submitted_by
CROSS JOIN LATERAL jsonb_array_elements(f.schema -> 'widgets') AS widget
WHERE widget->>'type' NOT IN ('section', 'divider', 'heading', 'paragraph')
ORDER BY fs."submittedAt" DESC, campo;


-- ────────────────────────────────────────────────────────────
-- PROCEDIMIENTO: crear_pivot('NombreFormulario')
-- Genera una vista con UNA FILA POR RESPUESTA y UNA COLUMNA POR CAMPO
-- Úsalo cada vez que crees un formulario nuevo
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE crear_pivot(p_formulario TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_cols      TEXT;
    v_view_name TEXT;
    v_sql       TEXT;
BEGIN
    v_view_name := 'v_pivot_' || lower(regexp_replace(p_formulario, '[^a-zA-Z0-9]', '_', 'g'));

    SELECT string_agg(
        format('MAX(CASE WHEN campo = %L THEN valor END) AS %I', label, label),
        ', '
        ORDER BY label
    )
    INTO v_cols
    FROM (
        SELECT DISTINCT widget->>'label' AS label
        FROM forms f
        CROSS JOIN LATERAL jsonb_array_elements(f.schema -> 'widgets') AS widget
        WHERE f.name ILIKE p_formulario
          AND widget->>'type' NOT IN ('section', 'divider', 'heading', 'paragraph', 'signature')
    ) labels;

    IF v_cols IS NULL THEN
        RAISE EXCEPTION 'No se encontró el formulario: %', p_formulario;
    END IF;

    v_sql := format('
        CREATE OR REPLACE VIEW %I AS
        SELECT
            respuesta_id,
            proyecto,
            carpeta,
            formulario,
            fecha_envio,
            diligenciado_por,
            %s
        FROM v_datos_diligenciados
        WHERE formulario ILIKE %L
        GROUP BY respuesta_id, proyecto, carpeta, formulario, fecha_envio, diligenciado_por
        ORDER BY fecha_envio DESC
    ', v_view_name, v_cols, p_formulario);

    EXECUTE v_sql;
    RAISE NOTICE 'Vista creada: %. Consulta: SELECT * FROM %s', v_view_name, v_view_name;
END;
$$;


-- ============================================================
--  CÓMO USAR
-- ============================================================

-- 1. Cada vez que creas un formulario nuevo, ejecuta esto en pgAdmin:
--    CALL crear_pivot('NombreExactoDelFormulario');

-- 2. Después consulta la vista generada:
--    SELECT * FROM v_pivot_nombreexactodelformulario;

-- Ejemplos ya creados:
--    CALL crear_pivot('Planeador');
--    SELECT * FROM v_pivot_planeador;

-- Si le cambias campos al formulario, vuelve a llamar crear_pivot()
-- para regenerar la vista con las nuevas columnas.
