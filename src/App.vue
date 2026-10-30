<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Monitor } from "@lucide/vue";
import { Toaster } from "@/components/ui/sonner";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader.vue";
import DownloadList from "@/components/DownloadList.vue";
import FleetTable from "@/components/FleetTable.vue";
import ProductSearch from "@/components/ProductSearch.vue";
import ProductView from "@/components/ProductView.vue";
import SignInGate from "@/components/SignInGate.vue";
import { boot, current, currentError, currentLoading, fleet, signedIn } from "@/state";

const search = ref<InstanceType<typeof ProductSearch>>();
const hasProduct = computed(() => !!(current.value || currentLoading.value || currentError.value));

function searchFor(model: string) {
  search.value?.setQuery(model);
}

onMounted(boot);
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />
    <!-- Signed out of axis.com nothing works but browsing, so the app waits for the sign-in. -->
    <SignInGate v-if="signedIn === false" />
    <div v-else class="grid items-start gap-6 px-7 py-5.5 max-sm:px-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section class="flex min-w-0 flex-col gap-5">
        <ProductSearch ref="search" />
        <FleetTable v-if="fleet" @search="searchFor" />
        <ProductView v-if="hasProduct" />
        <Empty v-else-if="!fleet" class="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Monitor /></EmptyMedia>
            <EmptyTitle>Find an AXIS product</EmptyTitle>
            <EmptyDescription>
              Type a model name. Pick it to see the latest firmware for each AXIS OS track, then add what you need to the download list.
              Or <Button variant="link" class="h-auto p-0" @click="search?.openImport()">import devices</Button> from OADM (Export devices .csv)
              or AXIS Device Manager (.json) to get the updates for every model at once.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
      <aside class="lg:sticky lg:top-5.5">
        <DownloadList />
      </aside>
    </div>
  </div>
  <Toaster position="bottom-center" />
</template>
