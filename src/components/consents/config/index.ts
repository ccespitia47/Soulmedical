import type { EntityConfig, EntityKey } from "./entityConfig";
import { soulConfig } from "./soulConfig";
import { saiConfig } from "./saiConfig";

export * from "./entityConfig";

export const ENTITIES: Record<EntityKey, EntityConfig> = {
  soul: soulConfig,
  sai: saiConfig,
};

/** Orden de aparición en el dropdown. */
export const ENTITY_ORDER: EntityKey[] = ["soul", "sai"];

export function getEntityConfig(key: EntityKey): EntityConfig {
  return ENTITIES[key];
}
