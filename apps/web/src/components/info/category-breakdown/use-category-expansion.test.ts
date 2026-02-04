import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCategoryExpansion } from "./use-category-expansion";

describe("useCategoryExpansion", () => {
  describe("toggleCategory", () => {
    it("カテゴリを展開状態にする", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleCategory("食費");
      });

      expect(result.current.isCategoryExpanded("食費")).toBe(true);
    });

    it("展開中のカテゴリを折りたたむ", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleCategory("食費");
      });
      expect(result.current.isCategoryExpanded("食費")).toBe(true);

      act(() => {
        result.current.toggleCategory("食費");
      });
      expect(result.current.isCategoryExpanded("食費")).toBe(false);
    });

    it("複数のカテゴリを独立して展開できる", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleCategory("食費");
        result.current.toggleCategory("交通費");
      });

      expect(result.current.isCategoryExpanded("食費")).toBe(true);
      expect(result.current.isCategoryExpanded("交通費")).toBe(true);
      expect(result.current.isCategoryExpanded("日用品")).toBe(false);
    });
  });

  describe("toggleSubCategory", () => {
    it("サブカテゴリを展開状態にする", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleSubCategory("食費:外食");
      });

      expect(result.current.isSubCategoryExpanded("食費:外食")).toBe(true);
    });

    it("展開中のサブカテゴリを折りたたむ", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleSubCategory("食費:外食");
      });
      expect(result.current.isSubCategoryExpanded("食費:外食")).toBe(true);

      act(() => {
        result.current.toggleSubCategory("食費:外食");
      });
      expect(result.current.isSubCategoryExpanded("食費:外食")).toBe(false);
    });

    it("複数のサブカテゴリを独立して展開できる", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleSubCategory("食費:外食");
        result.current.toggleSubCategory("食費:食料品");
      });

      expect(result.current.isSubCategoryExpanded("食費:外食")).toBe(true);
      expect(result.current.isSubCategoryExpanded("食費:食料品")).toBe(true);
      expect(result.current.isSubCategoryExpanded("交通費:電車")).toBe(false);
    });
  });

  describe("カテゴリとサブカテゴリの独立性", () => {
    it("カテゴリとサブカテゴリの状態は独立している", () => {
      const { result } = renderHook(() => useCategoryExpansion());

      act(() => {
        result.current.toggleCategory("食費");
        result.current.toggleSubCategory("食費:外食");
      });

      // カテゴリを折りたたんでも、サブカテゴリは影響を受けない
      act(() => {
        result.current.toggleCategory("食費");
      });

      expect(result.current.isCategoryExpanded("食費")).toBe(false);
      expect(result.current.isSubCategoryExpanded("食費:外食")).toBe(true);
    });
  });
});
