<script setup lang="ts">
import { computed } from "vue";
import { RefreshCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { indexAt, indexLoading, products, refreshIndex, setSource, sourcesOn } from "@/state";
import type { Source } from "@/lib/axis";

const sources: { id: Source; label: string }[] = [
  { id: "MPQT", label: "Cameras" },
  { id: "PACS", label: "Audio & other" },
];

const status = computed(() => {
  if (indexLoading.value) return "Loading product index…";
  const at = indexAt.value ? ` · ${new Date(indexAt.value).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}` : "";
  return `${products.value.length} products${at}`;
});
</script>

<template>
  <header class="flex flex-wrap items-center gap-3 border-b px-7 py-3.5 max-sm:px-4">
    <img class="size-7 rounded-md" src="/app-icon.png" alt="">
    <h1 class="text-xl font-bold tracking-tight">OADM Firmware Downloader for AXIS devices</h1>
    <div class="ml-auto flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <label v-for="s in sources" :key="s.id" class="flex cursor-pointer items-center gap-2 text-foreground/80 select-none">
        <Checkbox :model-value="sourcesOn[s.id]" @update:model-value="v => setSource(s.id, v === true)" />
        {{ s.label }}
      </label>
      <span class="flex items-center gap-1">
        {{ status }}
        <Button variant="ghost" size="icon-xs" title="Refresh product index" :disabled="indexLoading" @click="refreshIndex">
          <RefreshCw :class="indexLoading && 'animate-spin'" />
        </Button>
      </span>
    </div>
  </header>
</template>
