<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FileUp } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxAnchor, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { type Product, displayName } from "@/lib/axis";
import { addFleetProduct, closeProduct, fleet, importFile, searchProducts, showProduct, sourcesOn } from "@/state";

const query = ref("");
const open = ref(false);
const fileInput = ref<HTMLInputElement>();

// Our own ranking (exact, prefix, contains) instead of the combobox filter;
// sourcesOn is read so toggling a source refreshes the suggestions.
const suggestions = computed(() => (sourcesOn.MPQT, sourcesOn.PACS, searchProducts(query.value)));
// Typing opens the list; text set by a pick does not.
let picked = false;
// Clearing the box also closes the product it showed.
watch(query, q => {
  if (picked) { picked = false; return; }
  open.value = !!q.trim();
  if (!q.trim()) closeProduct();
});

// While devices are imported a picked product joins that list (and the box
// clears for the next one); otherwise it opens. Either way the search is done.
function pick(p: unknown) {
  if (!p) return;
  const product = p as Product;
  open.value = false;
  const text = fleet.value ? "" : displayName(product.name);
  picked = query.value !== text;
  query.value = text;
  if (fleet.value) addFleetProduct(product);
  else showProduct(product);
  inputEl()?.blur();
}

// Enter with nothing highlighted takes the top match; a highlighted item is
// picked by the combobox itself.
function onEnter() {
  if (!open.value || document.querySelector("[data-slot=combobox-item][data-highlighted]")) return;
  if (suggestions.value[0]) pick(suggestions.value[0]);
}

const inputEl = () => document.querySelector<HTMLInputElement>("[data-slot=combobox-input]");

function onGlobalKey(e: KeyboardEvent) {
  if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea, select")) {
    e.preventDefault();
    inputEl()?.focus();
    inputEl()?.select();
  }
}
onMounted(() => { document.addEventListener("keydown", onGlobalKey); inputEl()?.focus(); });
onBeforeUnmount(() => document.removeEventListener("keydown", onGlobalKey));

function onFile(e: Event) {
  const el = e.target as HTMLInputElement;
  const file = el.files?.[0];
  el.value = "";
  if (file) importFile(file);
}

defineExpose({
  openImport: () => fileInput.value?.click(),
  setQuery(q: string) {
    query.value = q;
    inputEl()?.focus();
  },
});
</script>

<template>
  <div class="flex items-center gap-2">
    <Combobox
      v-model:open="open"
      :model-value="null"
      ignore-filter
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      by="name"
      class="flex-1"
      @update:model-value="pick"
    >
      <ComboboxAnchor class="w-full">
        <ComboboxInput
          v-model="query"
          :placeholder="fleet ? 'Add a product to the imported list, e.g. M3098-LV…' : 'Search product, e.g. M3098-LV, P1375, C1410…'"
          autocomplete="off"
          spellcheck="false"
          @keydown.enter="onEnter"
        />
      </ComboboxAnchor>
      <ComboboxList>
        <ComboboxEmpty>No products match “{{ query }}”</ComboboxEmpty>
        <ComboboxGroup>
          <ComboboxItem v-for="p in suggestions" :key="p.src + p.name" :value="p">
            <span class="font-medium">{{ displayName(p.name) }}</span>
            <span class="ml-auto text-xs text-muted-foreground">{{ p.modified.split(" ")[0] }}</span>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxList>
    </Combobox>
    <Button variant="outline" title="Import an OADM device list (.csv) or an AXIS Device Manager export (.json, 1.x and 2.x)" @click="fileInput?.click()">
      <FileUp /> Import devices
    </Button>
    <input ref="fileInput" type="file" accept=".csv,.json,text/csv,application/json" hidden @change="onFile">
  </div>
</template>
