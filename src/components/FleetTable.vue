<script setup lang="ts">
import { ref } from "vue";
import { Check, Plus, Search, X } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Version, displayName, latestActive, latestLts, ltsOf, versionLabel } from "@/lib/axis";
import type { Plan, Track } from "@/lib/devices";
import {
  type FleetRow, addAll, addSelected, applyTrack, choose, clearFleet, fleet, fleetLoading, fleetRows, inList, notQueued, removeDir, removeFleetRow, showProduct,
} from "@/state";

const emit = defineEmits<{ search: [model: string] }>();
const busy = ref<string | null>(null);

function tags(v: Version, plan: Plan) {
  const t: string[] = [];
  const lts = ltsOf(v);
  const same = plan.versions.filter(x => x.variant?.name === v.variant?.name);
  if (v.isLatest) t.push("version not published");
  else if (v.special) t.push("special build");
  else if (lts) t.push(lts + (v === latestLts(same) ? " latest" : ""));
  else if (v === latestActive(same)) t.push("Active");
  return t;
}

// The row's versions per folder: the product's own first, then each variant.
function groups(r: FleetRow) {
  const byFolder = new Map<string, { label: string; versions: Version[] }>();
  for (const v of r.plan.versions) {
    const name = v.variant?.name || r.match!.p.name;
    if (!byFolder.has(name)) byFolder.set(name, { label: displayName(name), versions: [] });
    byFolder.get(name)!.versions.push(v);
  }
  return [...byFolder.values()];
}

async function run(key: string, fn: () => Promise<unknown>) {
  busy.value = key;
  try { await fn(); } finally { busy.value = null; }
}

function toggle(r: FleetRow) {
  const v = r.plan.selected!;
  if (inList(v.path)) removeDir(v.path);
  else run(r.key, () => addSelected([r]));
}

function open(r: FleetRow) {
  showProduct(r.match!.p);
  setTimeout(() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

const deviceCount = (r: FleetRow) => r.devices.filter(d => !d.added).length;
</script>

<template>
  <Card class="gap-0 py-0">
    <CardHeader class="border-b py-3.5">
      <CardTitle>Imported devices</CardTitle>
      <CardAction class="flex gap-2">
        <Button variant="ghost" size="sm" @click="clearFleet">Clear</Button>
        <Select :model-value="fleet?.track || 'recommended'" :disabled="fleetLoading" @update:model-value="v => applyTrack(v as Track)">
          <SelectTrigger size="sm" class="w-40" title="Set every row to this version">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="lts">Latest LTS</SelectItem>
            <SelectItem value="active">Active track</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" :disabled="fleetLoading || !!busy || !notQueued.length" title="Add the version chosen in every row to the download list" @click="run('all', addAll)">
          <Spinner v-if="busy === 'all'" /> Add all<template v-if="notQueued.length"> ({{ notQueued.length }})</template>
        </Button>
      </CardAction>
    </CardHeader>
    <Table>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead class="pl-4">Model</TableHead>
          <TableHead>Devices</TableHead>
          <TableHead>Installed</TableHead>
          <TableHead>Update to</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="r in fleetRows" :key="r.key">
          <TableCell class="pl-4" :title="r.raw">
            <template v-if="r.match">
              <Button variant="link" class="h-auto p-0 font-semibold" @click="open(r)">{{ displayName(r.match.p.name) }}</Button>
              <Badge v-if="!r.match.exact" variant="secondary" class="ml-2" :title="`No folder named exactly “${r.model}”; closest match`">guess</Badge>
            </template>
            <span v-else>{{ r.model }}</span>
          </TableCell>
          <TableCell>{{ deviceCount(r) || "" }}</TableCell>
          <TableCell>
            <div v-for="[fw, n] in r.plan.installed" :key="fw" class="font-mono text-xs text-muted-foreground">
              {{ fw }}<span v-if="n > 1"> ×{{ n }}</span>
            </div>
          </TableCell>
          <TableCell>
            <Spinner v-if="r.plan.state === 'loading'" />
            <span v-else-if="r.plan.state === 'error'" class="text-destructive">Could not load versions</span>
            <span v-else-if="r.plan.state === 'none'" class="flex items-center gap-2 text-muted-foreground">
              Nothing found
              <Button variant="link" size="sm" class="h-auto p-0" @click="emit('search', r.model)"><Search /> Search</Button>
            </span>
            <span v-else-if="!r.plan.selected" class="text-muted-foreground">No firmware</span>
            <div v-else class="flex items-center gap-3">
              <Select :model-value="r.plan.selected.path" @update:model-value="v => choose(r, String(v))">
                <SelectTrigger class="min-w-80">
                  <!-- Own content: the default copies the item as plain text and loses the small grey track label. -->
                  <SelectValue>
                    <span v-if="r.plan.selected.variant" class="font-medium">{{ displayName(r.plan.selected.variant.name) }} ·</span>
                    <span class="font-medium">{{ versionLabel(r.plan.selected) }}</span>
                    <span v-for="t in tags(r.plan.selected, r.plan)" :key="t" class="ml-1.5 text-xs text-muted-foreground">{{ t }}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <template v-for="(g, gi) in groups(r)" :key="g.label">
                    <SelectSeparator v-if="gi > 0" />
                    <SelectGroup>
                      <SelectLabel v-if="groups(r).length > 1">{{ g.label }}</SelectLabel>
                      <SelectItem v-for="v in g.versions" :key="v.path" :value="v.path">
                        <span v-if="v.variant" class="font-medium">{{ displayName(v.variant.name) }} ·</span>
                        <span class="font-medium">{{ versionLabel(v) }}</span>
                        <span v-for="t in tags(v, r.plan)" :key="t" class="ml-1.5 text-xs text-muted-foreground">{{ t }}</span>
                      </SelectItem>
                    </SelectGroup>
                  </template>
                </SelectContent>
              </Select>
              <Badge v-if="r.plan.upToDate" variant="outline">Up to date</Badge>
            </div>
          </TableCell>
          <TableCell class="pr-4 text-right whitespace-nowrap">
            <template v-if="r.plan.selected">
              <Button v-if="inList(r.plan.selected.path)" size="sm" variant="secondary" @click="toggle(r)"><Check /> In list</Button>
              <Button v-else size="sm" :disabled="busy === r.key" @click="toggle(r)"><Spinner v-if="busy === r.key" /><Plus v-else /> Add</Button>
            </template>
            <Button v-if="r.devices.every(d => d.added)" variant="ghost" size="icon-sm" class="ml-1" title="Remove from list" @click="removeFleetRow(r)">
              <X />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </Card>
</template>
