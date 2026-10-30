<script setup lang="ts">
import { ExternalLink } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { viewer } from "@/viewer";
</script>

<template>
  <!-- Non-modal: the app stays usable, and clicking another link updates the sheet. -->
  <Sheet v-model:open="viewer.open" :modal="false">
    <SheetContent class="gap-0 p-0 data-[side=right]:w-(--viewer-w) data-[side=right]:max-sm:w-full data-[side=right]:sm:max-w-none" @interact-outside="e => e.preventDefault()">
      <SheetHeader class="flex-row items-center gap-2 border-b py-3.5 pr-12">
        <SheetTitle class="min-w-0 flex-1 truncate">{{ viewer.title }}</SheetTitle>
        <SheetDescription class="sr-only">{{ viewer.url }}</SheetDescription>
        <Button as="a" variant="ghost" size="icon-sm" :href="viewer.url" target="_blank" rel="noopener" data-external title="Open in new tab">
          <ExternalLink />
        </Button>
      </SheetHeader>
      <div class="relative flex-1">
        <iframe :src="viewer.url || undefined" title="Page viewer" class="size-full" @load="viewer.loading = false; viewer.loads++" />
        <div v-if="viewer.loading" class="absolute inset-0 grid place-items-center bg-popover"><Spinner /></div>
      </div>
    </SheetContent>
  </Sheet>
</template>
