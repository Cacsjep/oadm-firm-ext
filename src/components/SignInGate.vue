<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { ArrowRight, LogIn } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { LOGIN_URL } from "@/lib/axis";
import { refreshSignIn } from "@/state";
import { openViewer, viewer } from "@/viewer";

// Signed out, the login is the only thing to do: open it right away. The gate goes
// away once the sign-in is detected, and the login panel goes with it.
//
// The axis_auth cookie appears while the login is still redirecting, so the first
// check can still land on the login page. Keep checking while waiting: the cookie
// read is local, axis.com is only asked once the cookie exists.
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  openViewer(LOGIN_URL, "Sign in to My Axis");
  poll = setInterval(refreshSignIn, 3000);
});
// Each page the login panel finishes loading may be the end of the sign-in.
watch(() => viewer.loads, () => refreshSignIn());
onBeforeUnmount(() => {
  clearInterval(poll);
  if (viewer.url === LOGIN_URL) viewer.open = false;
});
</script>

<template>
  <Empty class="min-h-[calc(100vh-120px)]">
    <EmptyHeader class="max-w-md">
      <!-- Lock on soft rings: theme colours only, so it follows light/dark. -->
      <svg viewBox="0 0 240 190" class="mb-4 h-44 w-auto" aria-hidden="true">
        <circle cx="120" cy="95" r="84" class="fill-primary/10" />
        <circle cx="120" cy="95" r="66" fill="none" stroke-dasharray="4 7" stroke-width="1.5" class="stroke-primary/40" />
        <circle cx="40" cy="44" r="3" class="fill-primary/40" />
        <circle cx="206" cy="58" r="2.5" class="fill-primary/30" />
        <circle cx="198" cy="150" r="3.5" class="fill-primary/25" />
        <circle cx="34" cy="132" r="2" class="fill-primary/35" />

        <circle cx="120" cy="95" r="44" class="fill-primary" />
        <path d="M106 92 v-11 a14 14 0 0 1 28 0 v11" fill="none" stroke-width="5" stroke-linecap="round" class="stroke-primary-foreground" />
        <rect x="99" y="90" width="42" height="30" rx="7" class="fill-primary-foreground" />
        <circle cx="120" cy="102" r="4.2" class="fill-primary" />
        <path d="M120 104 v7" stroke-width="3.5" stroke-linecap="round" class="stroke-primary" />
      </svg>
      <EmptyTitle class="text-xl">Sign in to My Axis first</EmptyTitle>
      <EmptyDescription>
        Firmware downloads need your axis.com account. This page notices the sign-in on its own.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <!-- Points at the login panel; without the panel there is nothing to point at, so offer to open it. -->
      <div v-if="viewer.open && viewer.url === LOGIN_URL" class="flex items-center gap-2 font-medium text-primary">
        Sign in on the right
        <ArrowRight class="size-5 animate-nudge-x motion-reduce:animate-none" />
      </div>
      <Button v-else @click="openViewer(LOGIN_URL, 'Sign in to My Axis')"><LogIn /> Sign in to My Axis</Button>
    </EmptyContent>
  </Empty>
</template>
