// Structural's part of Settings (ADR-059 step 4): the values its checks use (ADR-049), each with its
// review level and source, shown when the module is on. Moved from the app.
import type { UiContext } from "@prumo/ui-api";
import { defineComponent, h, type PropType } from "vue";
import { STRUCTURAL } from "../manifest";
import { materialTable } from "../materials";
import { structuralPacks } from "../packs";
import { unitWeightText } from "./text";

const packs = structuralPacks();

export const ValuesSection = defineComponent({
  props: { ctx: { type: Object as PropType<UiContext>, required: true } },
  setup(props) {
    return () => {
      const { ctx } = props;
      const t = ctx.t;
      const rows = materialTable(packs, ctx.project);
      if (!rows.length) return null;
      return h("div", [
        h("h4", t("values.title")),
        h("p", { class: "tip" }, t("values.tip")),
        h(
          "ul",
          { class: "values" },
          rows.map((r) => {
            const label = t(`material.${r.material}`);
            if (!r.unitWeight)
              return h("li", { key: r.material }, [
                h("span", label),
                h("span", { class: "muted" }, t("material.noValue.short")),
              ]);
            const w = unitWeightText(
              r.unitWeight,
              ctx.locale,
              t,
              packs.name(STRUCTURAL, r.unitWeight.pack, ctx.locale),
            );
            return h("li", { key: r.material, title: w.from }, [
              h("span", label),
              h("span", [w.text, " · ", h("em", { class: "unverified" }, w.review)]),
            ]);
          }),
        ),
      ]);
    };
  },
});
