#!/usr/bin/env node
/**
 * MCP server para SoulForms.
 *
 * Expone al agente (Claude Code) un set mínimo de tools para replicar
 * formularios desde otras plataformas (MoreApp, Jotform, Google Forms…)
 * dentro de SoulForms.
 *
 * Transport: stdio (estándar para servidores MCP locales en Claude Code).
 */

import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SoulFormsClient, type WidgetInstance } from "./client.js";
import { MoreAppClient } from "./moreapp-client.js";
import { WIDGET_CATALOG, findWidgetType } from "./widget-catalog.js";

const client = new SoulFormsClient({
  apiUrl: process.env.SOULFORMS_API_URL ?? "https://soulforms.com.co/api",
  apiKey: process.env.SOULFORMS_API_KEY ?? "",
});

// MoreApp es opcional: si las vars no están, las tools reportarán el error
// solo cuando el agente intente invocarlas. No queremos que el servidor
// falle al arrancar por configuración ausente de MoreApp.
const moreAppConfigured = Boolean(
  process.env.MOREAPP_API_TOKEN && process.env.MOREAPP_CUSTOMER_ID,
);
const moreapp = moreAppConfigured
  ? new MoreAppClient({
      apiUrl: process.env.MOREAPP_API_URL ?? "https://api.moreapp.com/api/v1.0",
      token: process.env.MOREAPP_API_TOKEN ?? "",
      customerId: process.env.MOREAPP_CUSTOMER_ID ?? "",
    })
  : null;

const server = new Server(
  { name: "soulforms", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// ─── Tool schemas ────────────────────────────────────────────────────────────

const widgetInputSchema = z.object({
  type: z.string().describe("Tipo del widget (ver list_widget_types)."),
  label: z.string().describe("Etiqueta visible junto al campo."),
  required: z
    .boolean()
    .optional()
    .describe("true = campo obligatorio. Default false."),
  config: z
    .record(z.unknown())
    .optional()
    .describe(
      "Overrides parciales sobre defaultConfig del tipo (ej: {options: ['Sí','No']} para select).",
    ),
});

const createFormSchema = z.object({
  name: z.string().min(1).describe("Nombre del formulario a crear."),
  folderId: z
    .string()
    .describe("ID de la carpeta donde se creará (usar list_folders)."),
  widgets: z
    .array(widgetInputSchema)
    .min(1)
    .describe(
      "Lista ordenada de widgets. Cada uno tomará su defaultConfig salvo overrides.",
    ),
});

const toolDefinitions = [
  {
    name: "list_widget_types",
    description:
      "Devuelve el catálogo completo de widgets disponibles en SoulForms con su defaultConfig, campos editables y descripción. Úsalo PRIMERO antes de componer un formulario para elegir el tipo correcto por campo.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_projects",
    description:
      "Lista los proyectos (contenedores raíz) accesibles para el usuario autenticado.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_folders",
    description:
      "Lista las carpetas de un proyecto. Las carpetas son donde viven los formularios.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "ID del proyecto (obtenido con list_projects).",
        },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_folder",
    description:
      "Crea una carpeta nueva dentro de un proyecto. Útil si el usuario quiere organizar formularios en un contenedor nuevo.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        projectId: { type: "string" },
        color: { type: "string", description: "Color hex (opcional)." },
        icon: {
          type: "string",
          description: "Emoji o icono (opcional, default 📁).",
        },
      },
      required: ["name", "projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_forms_in_folder",
    description:
      "Lista los formularios existentes en una carpeta. Útil para verificar que un formulario no esté duplicado antes de crear.",
    inputSchema: {
      type: "object",
      properties: { folderId: { type: "string" } },
      required: ["folderId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_form",
    description:
      "Devuelve el formulario completo (schema de widgets, versión, estado) por ID. Útil para verificar lo que acabas de crear.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_form",
    description:
      "Crea un formulario en la carpeta indicada con la lista de widgets. Cada widget necesita type+label; required y config son opcionales. Devuelve el formulario creado con sus IDs internos.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        folderId: { type: "string" },
        widgets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              label: { type: "string" },
              required: { type: "boolean" },
              config: { type: "object", additionalProperties: true },
            },
            required: ["type", "label"],
            additionalProperties: false,
          },
          minItems: 1,
        },
      },
      required: ["name", "folderId", "widgets"],
      additionalProperties: false,
    },
  },

  // ── MoreApp ────────────────────────────────────────────────────────────────
  // Útiles para clonar formularios desde MoreApp hacia SoulForms. El agente
  // típico encadena: list_moreapp_forms → get_moreapp_form → list_widget_types
  // → create_form (SoulForms).
  {
    name: "list_moreapp_forms",
    description:
      "Lista los formularios del customer configurado en MoreApp (necesita MOREAPP_API_TOKEN y MOREAPP_CUSTOMER_ID en el entorno). Devuelve id, nombre y carpeta de cada formulario para que el agente pueda elegir cuál clonar.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_moreapp_form",
    description:
      "Devuelve el detalle completo de un formulario de MoreApp (campos, tipos, propiedades). Usa el payload tal cual lo entrega MoreApp — el agente lo traduce a widgets de SoulForms consultando list_widget_types.",
    inputSchema: {
      type: "object",
      properties: {
        formId: {
          type: "string",
          description: "ID del formulario en MoreApp (de list_moreapp_forms).",
        },
      },
      required: ["formId"],
      additionalProperties: false,
    },
  },
];

// ─── Tool dispatch ───────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

function ok(payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function err(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

/**
 * Construye un WidgetInstance a partir de la entrada del agente, aplicando
 * los defaults del catálogo y validando el tipo. Si el tipo no existe,
 * lanza para que el agente sepa qué tipos sí hay disponibles.
 */
function buildWidget(input: z.infer<typeof widgetInputSchema>): WidgetInstance {
  const info = findWidgetType(input.type);
  if (!info) {
    throw new Error(
      `Tipo "${input.type}" no existe. Tipos válidos: ${WIDGET_CATALOG.map(
        (w) => w.type,
      ).join(", ")}`,
    );
  }
  return {
    id: randomUUID(),
    type: input.type,
    label: input.label,
    required: input.required ?? false,
    config: { ...info.defaultConfig, ...(input.config ?? {}) },
  };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case "list_widget_types":
        return ok(WIDGET_CATALOG);

      case "list_projects":
        return ok(await client.listProjects());

      case "list_folders": {
        const { projectId } = z
          .object({ projectId: z.string() })
          .parse(args);
        return ok(await client.listFolders(projectId));
      }

      case "create_folder": {
        const parsed = z
          .object({
            name: z.string(),
            projectId: z.string(),
            color: z.string().optional(),
            icon: z.string().optional(),
          })
          .parse(args);
        return ok(await client.createFolder(parsed));
      }

      case "list_forms_in_folder": {
        const { folderId } = z.object({ folderId: z.string() }).parse(args);
        return ok(await client.listFormsInFolder(folderId));
      }

      case "get_form": {
        const { id } = z.object({ id: z.string() }).parse(args);
        return ok(await client.getForm(id));
      }

      case "create_form": {
        const parsed = createFormSchema.parse(args);
        const widgets = parsed.widgets.map(buildWidget);
        return ok(
          await client.createForm({
            name: parsed.name,
            folderId: parsed.folderId,
            widgets,
          }),
        );
      }

      case "list_moreapp_forms": {
        if (!moreapp) {
          return err(
            "MoreApp no está configurado. Define MOREAPP_API_TOKEN y MOREAPP_CUSTOMER_ID en el entorno del MCP.",
          );
        }
        return ok(await moreapp.listForms());
      }

      case "get_moreapp_form": {
        if (!moreapp) {
          return err(
            "MoreApp no está configurado. Define MOREAPP_API_TOKEN y MOREAPP_CUSTOMER_ID en el entorno del MCP.",
          );
        }
        const { formId } = z.object({ formId: z.string() }).parse(args);
        return ok(await moreapp.getForm(formId));
      }

      default:
        return err(`Tool desconocida: ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});

// ─── Arranque ────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // El servidor queda vivo hasta que Claude Code cierre el stdio.
}

main().catch((e) => {
  // Lanza a stderr; Claude Code lo capturará en el log del MCP.
  console.error("soulforms-mcp fatal:", e);
  process.exit(1);
});
