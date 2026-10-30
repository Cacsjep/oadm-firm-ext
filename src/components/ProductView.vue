<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronRight, ExternalLink, Plus } from "@lucide/vue";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BASE, type TrackCard, type Version, buildTracks, displayName, ltsOf, releaseNotesUrl, versionLabel } from "@/lib/axis";
import { addToList, current, currentError, currentLoading, inList, noteAnchors, removeDir } from "@/state";

const busy = ref<string | null>(null);
// A product with only an unnumbered "latest" folder gets that as its one card.
const cards = computed<TrackCard[]>(() => {
  if (!current.value) return [];
  const tracks = buildTracks(current.value.versions);
  const latest = current.value.versions.find(v => v.isLatest);
  return tracks.length || !latest ? tracks : [{ v: latest, badge: { kind: "old", text: "Version not published" }, isActive: false }];
});
const notes = (v: Version) => releaseNotesUrl(v, noteAnchors.value);

const badgeVariant = { active: "default", lts: "secondary", old: "outline" } as const;

async function toggle(v: Version) {
  const c = current.value!;
  if (inList(v.path)) return removeDir(v.path);
  busy.value = v.path;
  try {
    await addToList(c.p, v);
    toast.success(`Added ${displayName(c.p.name)} ${versionLabel(v)}`);
  } catch (err) {
    toast.error("Could not add", { description: (err as Error).message });
  }
  busy.value = null;
}
</script>

<template>
  <section id="product" class="scroll-mt-4">
    <div v-if="currentLoading" class="flex items-center gap-2.5 py-8 text-muted-foreground">
      <Spinner /> Loading versions for {{ displayName(currentLoading.name) }}…
    </div>
    <div v-else-if="currentError" class="text-destructive">{{ currentError }}</div>
    <template v-else-if="current">
      <div class="mb-3.5 flex flex-wrap items-center gap-3">
        <h2 class="text-2xl font-bold tracking-tight">AXIS {{ displayName(current.p.name) }}</h2>
        <div class="ml-auto flex gap-3.5 text-sm">
          <a v-for="l in current.links" :key="l.url" :href="l.url" target="_blank" rel="noopener" class="text-primary hover:underline">{{ l.text }}</a>
          <a :href="BASE + current.path" target="_blank" rel="noopener" class="text-primary hover:underline">FTP folder</a>
        </div>
      </div>

      <!-- Fixed card width so cards don't stretch/reflow when the viewer panel opens. -->
      <div v-if="cards.length" class="grid grid-cols-[repeat(auto-fill,250px)] gap-3">
        <Card
          v-for="c in cards"
          :key="c.v.path"
          class="gap-2.5 p-3.5"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-muted-foreground">{{ c.v.isLatest ? "Latest folder" : "AXIS OS " + c.v.nums[0] }}</span>
            <Badge class="ml-auto" :variant="badgeVariant[c.badge.kind]">{{ c.badge.text }}</Badge>
          </div>
          <div class="font-mono text-2xl font-semibold tracking-tight">{{ versionLabel(c.v) }}</div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            Released {{ c.v.modified.split(" ")[0] || "unknown" }}
            <a v-if="!c.v.isLatest" :href="notes(c.v)" target="_blank" rel="noopener" :title="`AXIS OS ${versionLabel(c.v)} release notes`" class="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
              Release notes <ExternalLink class="size-3" />
            </a>
          </div>
          <Button v-if="inList(c.v.path)" variant="secondary" @click="toggle(c.v)"><Check /> In list</Button>
          <Button v-else :disabled="busy === c.v.path" @click="toggle(c.v)"><Spinner v-if="busy === c.v.path" /><Plus v-else /> Add</Button>
        </Card>
      </div>
      <div v-else class="text-destructive">No firmware versions found in this folder.</div>

      <Collapsible v-if="current.versions.length" class="mt-4">
        <CollapsibleTrigger class="group flex items-center gap-1 py-1.5 font-semibold text-foreground/80 hover:text-foreground">
          <ChevronRight class="size-4 transition-transform group-data-[state=open]:rotate-90" />
          All versions ({{ current.versions.length }})
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card class="mt-2 gap-0 py-0">
            <Table>
              <TableHeader>
                <TableRow class="hover:bg-transparent">
                  <TableHead class="pl-4">Version</TableHead><TableHead>Track</TableHead><TableHead>Date</TableHead><TableHead>Notes</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="v in current.versions" :key="v.path">
                  <TableCell class="pl-4 font-mono text-xs">{{ versionLabel(v) }}</TableCell>
                  <TableCell>{{ v.isLatest ? "Version not published" : v.special ? "Special build" : ltsOf(v) || "AXIS OS " + v.nums[0] }}</TableCell>
                  <TableCell>{{ v.modified }}</TableCell>
                  <TableCell>
                    <a v-if="!v.special && !v.isLatest" :href="notes(v)" target="_blank" rel="noopener" :title="`AXIS OS ${versionLabel(v)} release notes`" class="inline-flex items-center gap-1 text-primary hover:underline">
                      View <ExternalLink class="size-3" />
                    </a>
                  </TableCell>
                  <TableCell class="pr-4 text-right">
                    <Button v-if="inList(v.path)" size="sm" variant="secondary" @click="toggle(v)"><Check /> In list</Button>
                    <Button v-else size="sm" :disabled="busy === v.path" @click="toggle(v)"><Spinner v-if="busy === v.path" /><Plus v-else /> Add</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div v-if="current.extras.length" class="mt-3 text-xs text-muted-foreground">
        Other folders:
        <template v-for="(e, i) in current.extras" :key="e.url"><a :href="e.url" target="_blank" rel="noopener" class="text-primary underline">{{ e.name }}</a><span v-if="i < current.extras.length - 1">, </span></template>
      </div>
    </template>
  </section>
</template>
