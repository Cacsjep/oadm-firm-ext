<script setup lang="ts">
import { Download, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { type ListItem, clearList, downloadAll, list, pendingCount, removeItem, totalSize } from "@/state";
import { displayName, fmtSize } from "@/lib/axis";

const pct = (i: ListItem) => (i.total ? Math.round(((i.received || 0) / i.total) * 100) : 0);
</script>

<template>
  <Card class="gap-0 overflow-hidden py-0">
    <CardHeader class="border-b py-3.5">
      <CardTitle>Download list</CardTitle>
      <CardAction class="text-xs text-muted-foreground">
        {{ list.length ? `${list.length} file${list.length > 1 ? "s" : ""} · ${fmtSize(totalSize)}` : "0 files" }}
      </CardAction>
    </CardHeader>
    <ul v-if="list.length" class="max-h-[calc(100vh-260px)] overflow-auto">
      <li v-for="(i, idx) in list" :key="i.url" class="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 border-b px-4 py-2.5">
        <div>
          <span class="font-semibold">{{ displayName(i.product) }}</span>
          <span class="ml-1.5 font-mono text-xs text-primary">{{ i.version }}</span>
        </div>
        <Button variant="ghost" size="icon-sm" class="row-span-2 self-center" title="Remove" @click="removeItem(idx)">
          <X />
        </Button>
        <div class="truncate text-xs text-muted-foreground" :title="i.file">{{ i.file }} · {{ i.size }}</div>
        <div v-if="i.state === 'downloading'" class="col-span-2 mt-1 flex items-center gap-2 text-xs">
          <Progress :model-value="pct(i)" class="h-1 flex-1" /> {{ pct(i) }}%
        </div>
        <div v-else-if="i.state === 'complete'" class="col-span-2 mt-1 text-xs text-muted-foreground">✓ Downloaded</div>
        <div v-else-if="i.state === 'auth'" class="col-span-2 mt-1 text-xs text-destructive">
          Got a login page instead of firmware. <a href="https://www.axis.com/" target="_blank" rel="noopener" data-external class="underline">Sign in on axis.com</a>, then download again.
        </div>
        <div v-else-if="i.state === 'failed'" class="col-span-2 mt-1 text-xs text-destructive">Failed: {{ i.error || "unknown error" }}</div>
      </li>
    </ul>
    <div v-else class="px-4 py-6 text-center text-sm text-muted-foreground">Nothing queued yet. Add firmware from a product.</div>
    <div class="flex gap-2 p-3">
      <Button variant="ghost" :disabled="!list.length" @click="clearList">Clear</Button>
      <Button class="flex-1" :disabled="!pendingCount" @click="downloadAll"><Download /> Download all</Button>
    </div>
  </Card>
</template>
