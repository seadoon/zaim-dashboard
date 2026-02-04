import type { Db } from "../index";
import { schema } from "../index";
import { getOrCreate } from "../utils";

/**
 * Get or create institution category by name
 * Returns the category ID
 */
export function getOrCreateInstitutionCategory(db: Db, categoryName: string): number {
  return getOrCreate(
    db,
    schema.institutionCategories,
    schema.institutionCategories.name,
    categoryName,
  );
}

/**
 * Get all institution categories
 */
export function getAllInstitutionCategories(db: Db) {
  return db
    .select()
    .from(schema.institutionCategories)
    .orderBy(schema.institutionCategories.displayOrder)
    .all();
}
